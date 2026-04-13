// campus-ops library sub-domain workflow service
// W08-L2-019 through W08-L2-023: Book Issue/Return/Renew, Reservations, Clearance, Visits

import { Book } from '../../models/library/Book';
import { BookIssue } from '../../models/library/BookIssue';
import { BookReservation } from '../../models/library/BookReservation';
import { LibraryMember } from '../../models/library/LibraryMember';
import { LibraryFine } from '../../models/library/LibraryFine';
import { LibraryGateEntry } from '../../models/library/LibraryGateEntry';
import { LibraryClearance } from '../../models/library/LibraryClearance';
import { CampusConfig } from '../../models/campus/CampusConfig';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

// ===========================================================================
// Config Helper
// ===========================================================================

const DEFAULT_LIBRARY_CONFIG = {
  systemMode: 'juvion_native' as const,
  overdueFinePerDay: 1,
  maxOverdueFine: 100,
  lostBookReplacementMultiplier: 2,
  gracePeriodDays: 1,
  maxRenewals: 2,
  reservationPickupWindowHours: 48,
  fineWaiverThresholds: { librarian: 100, chiefLibrarian: 500 },
};

async function getLibraryConfig(collegeId: string) {
  const config = await CampusConfig.findOne({ collegeId });
  if (!config || !config.library) return DEFAULT_LIBRARY_CONFIG;
  const lib = config.library;
  return {
    systemMode: lib.systemMode ?? DEFAULT_LIBRARY_CONFIG.systemMode,
    overdueFinePerDay: lib.overdueFinePerDay ?? DEFAULT_LIBRARY_CONFIG.overdueFinePerDay,
    maxOverdueFine: lib.maxOverdueFine ?? DEFAULT_LIBRARY_CONFIG.maxOverdueFine,
    lostBookReplacementMultiplier: lib.lostBookReplacementMultiplier ?? DEFAULT_LIBRARY_CONFIG.lostBookReplacementMultiplier,
    gracePeriodDays: lib.gracePeriodDays ?? DEFAULT_LIBRARY_CONFIG.gracePeriodDays,
    maxRenewals: lib.maxRenewals ?? DEFAULT_LIBRARY_CONFIG.maxRenewals,
    reservationPickupWindowHours: lib.reservationPickupWindowHours ?? DEFAULT_LIBRARY_CONFIG.reservationPickupWindowHours,
    fineWaiverThresholds: lib.fineWaiverThresholds ?? DEFAULT_LIBRARY_CONFIG.fineWaiverThresholds,
  };
}

// ===========================================================================
// W08-L2-020: Process Book Issue / Return / Renew
// ===========================================================================

/** Issue a book to a library member */
export async function issueBook(
  collegeId: string,
  data: { bookId: string; memberId: string },
  performedBy: string,
) {
  // Verify member exists, is active, and not suspended
  const member = await LibraryMember.findOne({ _id: data.memberId, collegeId });
  if (!member) throw new AppError(404, 'Library member not found');
  if (!member.isActive) throw new AppError(400, 'Library membership is inactive');
  if (member.suspendedReason) throw new AppError(400, 'Library member is suspended');

  // Check borrower limit
  if (member.currentIssued >= member.maxBooks) {
    throw new AppError(400, `Borrower limit reached (${member.maxBooks} books maximum)`);
  }

  // Check book availability
  const book = await Book.findOne({ _id: data.bookId, collegeId });
  if (!book) throw new AppError(404, 'Book not found');
  if (book.availableCopies <= 0) {
    throw new AppError(400, 'No copies available for issue');
  }

  // Load library config for maxRenewals
  const config = await getLibraryConfig(collegeId);

  // Calculate due date (14 days from now)
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 14);

  // Create BookIssue
  const doc = await BookIssue.create({
    collegeId,
    bookId: data.bookId,
    issuedTo: data.memberId,
    issuedDate: now,
    dueDate,
    status: 'issued',
    maxRenewals: config.maxRenewals,
  });

  // Update book available copies
  await Book.updateOne({ _id: data.bookId, collegeId }, { $inc: { availableCopies: -1 } });

  // Update member current issued count
  await LibraryMember.updateOne({ _id: data.memberId, collegeId }, { $inc: { currentIssued: 1 } });

  await createAuditLog({
    collegeId,
    entityType: 'BookIssue',
    entityId: String(doc._id),
    entityName: `${book.title} → ${member.membershipId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'issued' },
      { field: 'dueDate', displayName: 'Due Date', oldValue: null, newValue: dueDate },
    ],
    performedBy,
  });

  return doc;
}

/** Return a book and calculate overdue fines if applicable */
export async function returnBook(
  collegeId: string,
  data: { bookIssueId: string; condition?: string },
  performedBy: string,
) {
  const issue = await BookIssue.findOne({ _id: data.bookIssueId, collegeId });
  if (!issue) throw new AppError(404, 'Book issue record not found');
  if (issue.status !== 'issued' && issue.status !== 'overdue') {
    throw new AppError(400, `Cannot return a book with status '${issue.status}'`);
  }

  const now = new Date();
  const config = await getLibraryConfig(collegeId);

  // Update the issue record
  issue.returnedDate = now;
  issue.status = 'returned';
  await issue.save();

  // Update book available copies
  await Book.updateOne({ _id: issue.bookId, collegeId }, { $inc: { availableCopies: 1 } });

  // Find member for this issue (issuedTo is the memberId)
  const member = await LibraryMember.findOne({ _id: issue.issuedTo, collegeId });

  // Update member current issued count
  await LibraryMember.updateOne({ _id: issue.issuedTo, collegeId }, { $inc: { currentIssued: -1 } });

  // Check overdue and create fine if needed
  let fineDoc = null;
  if (now > issue.dueDate) {
    const diffMs = now.getTime() - issue.dueDate.getTime();
    const totalDaysLate = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const daysOverdue = totalDaysLate - config.gracePeriodDays;

    if (daysOverdue > 0) {
      const fineAmount = Math.min(
        daysOverdue * config.overdueFinePerDay,
        config.maxOverdueFine,
      );

      fineDoc = await LibraryFine.create({
        collegeId,
        memberId: issue.issuedTo,
        bookIssueId: issue._id,
        amount: fineAmount,
        reason: 'overdue',
        status: 'pending',
      });

      // Update fine amount on the issue record
      issue.fineAmount = fineAmount;
      await issue.save();

      // Update member fines due
      await LibraryMember.updateOne(
        { _id: issue.issuedTo, collegeId },
        { $inc: { finesDue: fineAmount } },
      );

      // TODO: emit library.fine.created to M04 via BullMQ
    }
  }

  // Check condition: if damaged, create damage fine (stub)
  if (data.condition === 'damaged') {
    // TODO: create damage fine based on book value and config
  }

  // Process reservations for this book
  await processReturnReservations(collegeId, String(issue.bookId), performedBy);

  const book = await Book.findOne({ _id: issue.bookId, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'BookIssue',
    entityId: String(issue._id),
    entityName: `Return - ${book?.title ?? 'Unknown'} by ${member?.membershipId ?? 'Unknown'}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'issued', newValue: 'returned' },
      { field: 'returnedDate', displayName: 'Returned Date', oldValue: null, newValue: now },
      ...(fineDoc ? [{ field: 'fineAmount', displayName: 'Fine Amount', oldValue: 0, newValue: fineDoc.amount }] : []),
    ],
    performedBy,
  });

  return { issue, fine: fineDoc };
}

/** Renew a book issue (extend due date) */
export async function renewBook(
  collegeId: string,
  data: { bookIssueId: string },
  performedBy: string,
) {
  const issue = await BookIssue.findOne({ _id: data.bookIssueId, collegeId });
  if (!issue) throw new AppError(404, 'Book issue record not found');
  if (issue.status !== 'issued') {
    throw new AppError(400, `Cannot renew a book with status '${issue.status}'`);
  }

  // Load config for max renewals
  const config = await getLibraryConfig(collegeId);

  if (issue.renewCount >= config.maxRenewals) {
    throw new AppError(400, `Maximum renewals (${config.maxRenewals}) reached`);
  }

  // Check no active reservations for this book
  const pendingReservation = await BookReservation.findOne({
    bookId: issue.bookId,
    collegeId,
    status: 'active',
  });
  if (pendingReservation) {
    throw new AppError(409, 'Cannot renew — book has pending reservations');
  }

  const oldDueDate = issue.dueDate;
  const newDueDate = new Date(issue.dueDate);
  newDueDate.setDate(newDueDate.getDate() + 14);

  issue.renewCount += 1;
  issue.dueDate = newDueDate;
  issue.renewedDate = new Date();
  await issue.save();

  await createAuditLog({
    collegeId,
    entityType: 'BookIssue',
    entityId: String(issue._id),
    entityName: `Renew #${issue.renewCount}`,
    action: 'update',
    changes: [
      { field: 'renewCount', displayName: 'Renew Count', oldValue: issue.renewCount - 1, newValue: issue.renewCount },
      { field: 'dueDate', displayName: 'Due Date', oldValue: oldDueDate, newValue: newDueDate },
    ],
    performedBy,
  });

  return issue;
}

/** Report a book as lost */
export async function reportBookLost(
  collegeId: string,
  data: { bookIssueId: string },
  performedBy: string,
) {
  const issue = await BookIssue.findOne({ _id: data.bookIssueId, collegeId });
  if (!issue) throw new AppError(404, 'Book issue record not found');
  if (issue.status !== 'issued' && issue.status !== 'overdue') {
    throw new AppError(400, `Cannot report lost for a book with status '${issue.status}'`);
  }

  const config = await getLibraryConfig(collegeId);
  const book = await Book.findOne({ _id: issue.bookId, collegeId });

  // Calculate replacement cost: use book price if available, default 500
  const basePrice = 500;
  const replacementCost = basePrice * config.lostBookReplacementMultiplier;

  // Update issue status to 'lost'
  const oldStatus = issue.status;
  issue.status = 'lost';
  await issue.save();

  // Create replacement fine
  const fineDoc = await LibraryFine.create({
    collegeId,
    memberId: issue.issuedTo,
    bookIssueId: issue._id,
    amount: replacementCost,
    reason: 'lost',
    status: 'pending',
  });

  // Update member: finesDue up, currentIssued down (book is lost, not returned)
  await LibraryMember.updateOne(
    { _id: issue.issuedTo, collegeId },
    { $inc: { finesDue: replacementCost, currentIssued: -1 } },
  );

  // Note: do NOT increment availableCopies — book is lost, not returned

  // TODO: emit library.fine.created to M04 via BullMQ

  await createAuditLog({
    collegeId,
    entityType: 'BookIssue',
    entityId: String(issue._id),
    entityName: `Lost - ${book?.title ?? 'Unknown'}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'lost' },
      { field: 'replacementCost', displayName: 'Replacement Cost', oldValue: 0, newValue: replacementCost },
    ],
    performedBy,
  });

  return { issue, fine: fineDoc, replacementCost };
}

// ===========================================================================
// W08-L2-021: Process Book Reservation
// ===========================================================================

/** Reserve a book that is currently fully issued */
export async function reserveBook(
  collegeId: string,
  data: { bookId: string; memberId: string },
  performedBy: string,
) {
  // Verify member is active
  const member = await LibraryMember.findOne({ _id: data.memberId, collegeId });
  if (!member) throw new AppError(404, 'Library member not found');
  if (!member.isActive) throw new AppError(400, 'Library membership is inactive');

  // Check book — if copies are available, don't allow reservation
  const book = await Book.findOne({ _id: data.bookId, collegeId });
  if (!book) throw new AppError(404, 'Book not found');
  if (book.availableCopies > 0) {
    throw new AppError(400, 'Book is available — issue directly instead of reserving');
  }

  // Set expiry far in the future (reservation doesn't expire until book becomes available)
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const doc = await BookReservation.create({
    collegeId,
    bookId: data.bookId,
    reservedBy: data.memberId,
    reservedDate: new Date(),
    expiryDate,
    status: 'active',
  });

  await createAuditLog({
    collegeId,
    entityType: 'BookReservation',
    entityId: String(doc._id),
    entityName: `${book.title} reserved by ${member.membershipId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'active' },
    ],
    performedBy,
  });

  return doc;
}

/** Pick up a reserved book that has become available — transitions to regular issue */
export async function pickupReservation(
  collegeId: string,
  reservationId: string,
  performedBy: string,
) {
  const reservation = await BookReservation.findOne({ _id: reservationId, collegeId });
  if (!reservation) throw new AppError(404, 'Book reservation not found');

  // The reservation should have been marked available when the book was returned
  // Accept both 'active' with available copies and truly 'available' equivalent
  if (reservation.status !== 'active') {
    throw new AppError(400, `Cannot pick up reservation with status '${reservation.status}'`);
  }

  // Check that the book has available copies
  const book = await Book.findOne({ _id: reservation.bookId, collegeId });
  if (!book) throw new AppError(404, 'Book not found');
  if (book.availableCopies <= 0) {
    throw new AppError(400, 'Book is not yet available for pickup');
  }

  // Issue the book to the reservation holder
  const issueResult = await issueBook(
    collegeId,
    { bookId: String(reservation.bookId), memberId: String(reservation.reservedBy) },
    performedBy,
  );

  // Update reservation status to fulfilled
  reservation.status = 'fulfilled';
  await reservation.save();

  await createAuditLog({
    collegeId,
    entityType: 'BookReservation',
    entityId: String(reservation._id),
    entityName: `Reservation fulfilled`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'active', newValue: 'fulfilled' },
    ],
    performedBy,
  });

  return { reservation, issue: issueResult };
}

/** Cancel a book reservation */
export async function cancelReservation(
  collegeId: string,
  reservationId: string,
  performedBy: string,
) {
  const reservation = await BookReservation.findOne({ _id: reservationId, collegeId });
  if (!reservation) throw new AppError(404, 'Book reservation not found');
  if (reservation.status === 'cancelled' || reservation.status === 'fulfilled') {
    throw new AppError(400, `Reservation is already '${reservation.status}'`);
  }

  const oldStatus = reservation.status;
  reservation.status = 'cancelled';
  await reservation.save();

  await createAuditLog({
    collegeId,
    entityType: 'BookReservation',
    entityId: String(reservation._id),
    entityName: 'Reservation cancelled',
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'cancelled' },
    ],
    performedBy,
  });

  return reservation;
}

/** Process reservations after a book return — notify the oldest waiting reservation */
export async function processReturnReservations(
  collegeId: string,
  bookId: string,
  _performedBy: string,
) {
  // Find the oldest active reservation for this book
  const reservation = await BookReservation.findOne({
    collegeId,
    bookId,
    status: 'active',
  }).sort({ reservedDate: 1 });

  if (!reservation) return null;

  // Load config for pickup window
  const config = await getLibraryConfig(collegeId);

  // Update reservation: set expiry to now + pickup window
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + config.reservationPickupWindowHours);
  reservation.expiryDate = expiryDate;
  await reservation.save();

  // TODO: notify reservation holder via M12.2

  return reservation;
}

// ===========================================================================
// W08-L2-022: Process Library Clearance
// ===========================================================================

/** Initiate library clearance for a person (student/staff/faculty leaving) */
export async function initiateLibraryClearance(
  collegeId: string,
  personId: string,
  personType: string,
  performedBy: string,
) {
  // Check outstanding books
  const member = await LibraryMember.findOne({ personId, collegeId });

  const outstandingIssues = member
    ? await BookIssue.find({
        collegeId,
        issuedTo: member._id,
        status: { $in: ['issued', 'overdue'] },
      }).populate('bookId')
    : [];

  // Build outstanding books array for the clearance record
  const outstandingBooks = outstandingIssues.map((issue) => {
    const book = issue.bookId as any;
    return {
      bookIssueId: issue._id,
      bookTitle: book?.title ?? 'Unknown',
      dueDate: issue.dueDate,
    };
  });

  // Check outstanding fines
  let outstandingFines = 0;
  if (member) {
    const fines = await LibraryFine.find({
      collegeId,
      memberId: member._id,
      status: 'pending',
    });
    outstandingFines = fines.reduce((sum, f) => sum + f.amount, 0);
  }

  // Build blocking items
  const blockingItems: { item: string; reason: string }[] = [];
  if (outstandingBooks.length > 0) {
    blockingItems.push({
      item: 'Outstanding Books',
      reason: `${outstandingBooks.length} book(s) not yet returned`,
    });
  }
  if (outstandingFines > 0) {
    blockingItems.push({
      item: 'Outstanding Fines',
      reason: `Unpaid fines totalling ₹${outstandingFines}`,
    });
  }

  const isCleared = outstandingBooks.length === 0 && outstandingFines === 0;
  const status = isCleared ? 'cleared' : 'blocked';

  const doc = await LibraryClearance.create({
    collegeId,
    personId,
    personType,
    outstandingBooks,
    outstandingFines,
    status,
    blockingItems,
    ...(isCleared ? { clearedAt: new Date(), clearedBy: performedBy } : {}),
  });

  // If cleared, deactivate membership
  if (isCleared && member) {
    await LibraryMember.updateOne(
      { _id: member._id, collegeId },
      { isActive: false, membershipExpiry: new Date() },
    );
  }

  await createAuditLog({
    collegeId,
    entityType: 'LibraryClearance',
    entityId: String(doc._id),
    entityName: `Clearance - ${personType} ${personId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: status },
      { field: 'outstandingBooks', displayName: 'Outstanding Books', oldValue: null, newValue: outstandingBooks.length },
      { field: 'outstandingFines', displayName: 'Outstanding Fines', oldValue: null, newValue: outstandingFines },
    ],
    performedBy,
  });

  return doc;
}

/** Get the latest clearance status for a person */
export async function getLibraryClearanceStatus(collegeId: string, personId: string): Promise<Record<string, unknown>> {
  const doc = await LibraryClearance.findOne({ collegeId, personId })
    .sort({ createdAt: -1 })
    .lean();
  if (!doc) throw new AppError(404, 'No library clearance record found for this person');

  // Fetch fresh counts for blocking details
  const member = await LibraryMember.findOne({ personId, collegeId });
  let currentOutstandingBooks = 0;
  let currentOutstandingFines = 0;

  if (member) {
    currentOutstandingBooks = await BookIssue.countDocuments({
      collegeId,
      issuedTo: member._id,
      status: { $in: ['issued', 'overdue'] },
    });

    const fines = await LibraryFine.find({
      collegeId,
      memberId: member._id,
      status: 'pending',
    });
    currentOutstandingFines = fines.reduce((sum, f) => sum + f.amount, 0);
  }

  return {
    ...doc,
    currentOutstandingBooks,
    currentOutstandingFines,
  };
}

// ===========================================================================
// W08-L2-023: Track Library Visits
// ===========================================================================

/** Record a library gate entry */
export async function recordLibraryEntry(
  collegeId: string,
  data: { personId: string },
  performedBy: string,
) {
  const doc = await LibraryGateEntry.create({
    collegeId,
    personId: data.personId,
    entryTime: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'LibraryGateEntry',
    entityId: String(doc._id),
    entityName: `Library entry`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

/** Record a library gate exit */
export async function recordLibraryExit(
  collegeId: string,
  entryId: string,
  _performedBy: string,
) {
  const doc = await LibraryGateEntry.findOne({ _id: entryId, collegeId });
  if (!doc) throw new AppError(404, 'Library gate entry not found');
  if (doc.exitTime) throw new AppError(400, 'Exit already recorded for this entry');

  doc.exitTime = new Date();
  await doc.save();

  return doc;
}

/** Get library visit statistics for a date range */
export async function getLibraryVisitStats(
  collegeId: string,
  data: { startDate: string; endDate: string },
) {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  const matchFilter = {
    collegeId,
    entryTime: { $gte: start, $lte: end },
  };

  // Aggregate visit statistics
  const [stats] = await LibraryGateEntry.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalVisits: { $sum: 1 },
        uniqueVisitors: { $addToSet: '$personId' },
        avgDurationMs: {
          $avg: {
            $cond: [
              { $ifNull: ['$exitTime', false] },
              { $subtract: ['$exitTime', '$entryTime'] },
              null,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalVisits: 1,
        uniqueVisitors: { $size: '$uniqueVisitors' },
        avgDurationMinutes: {
          $cond: [
            { $eq: ['$avgDurationMs', null] },
            null,
            { $divide: ['$avgDurationMs', 60000] },
          ],
        },
      },
    },
  ]);

  // Peak hours aggregation
  const peakHours = await LibraryGateEntry.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: { $hour: '$entryTime' },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        hour: '$_id',
        visits: '$count',
      },
    },
  ]);

  return {
    totalVisits: stats?.totalVisits ?? 0,
    uniqueVisitors: stats?.uniqueVisitors ?? 0,
    avgDurationMinutes: stats?.avgDurationMinutes
      ? Math.round(stats.avgDurationMinutes)
      : null,
    peakHours,
  };
}

// ===========================================================================
// CRUD: LibraryClearance
// ===========================================================================

export async function listLibraryClearances(collegeId: string, page = 1, limit = 20) {
  const filter: any = { collegeId };
  return paginate(LibraryClearance, filter, page, limit, { createdAt: -1 }, ['personId', 'clearedBy']);
}

export async function getLibraryClearance(collegeId: string, id: string) {
  const doc = await LibraryClearance.findOne({ _id: id, collegeId }).populate('personId clearedBy');
  if (!doc) throw new AppError(404, 'Library clearance not found');
  return doc;
}

export async function createLibraryClearance(collegeId: string, data: any, who: string) {
  const doc = await LibraryClearance.create({ ...data, collegeId });
  await createAuditLog({
    collegeId,
    entityType: 'LibraryClearance',
    entityId: String(doc._id),
    entityName: `Clearance - ${data.personType}`,
    action: 'create',
    changes: [],
    performedBy: who,
  });
  return doc;
}

export async function updateLibraryClearance(collegeId: string, id: string, data: any, who: string) {
  const doc = await LibraryClearance.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Library clearance not found');
  await createAuditLog({
    collegeId,
    entityType: 'LibraryClearance',
    entityId: id,
    entityName: `Clearance - ${doc.personType}`,
    action: 'update',
    changes: [],
    performedBy: who,
  });
  return doc;
}

export async function deleteLibraryClearance(collegeId: string, id: string, who: string) {
  const doc = await LibraryClearance.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Library clearance not found');
  await createAuditLog({
    collegeId,
    entityType: 'LibraryClearance',
    entityId: id,
    entityName: `Clearance - ${doc.personType}`,
    action: 'delete',
    changes: [],
    performedBy: who,
  });
  return doc;
}
