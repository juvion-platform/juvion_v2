import { Types } from 'mongoose';
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Parent } from '../../models/people/Parent';
import { Section } from '../../models/academic-structure/Section';
import { Batch } from '../../models/academic-structure/Batch';
import { HostelRoom } from '../../models/welfare/HostelRoom';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { DemoCtx, DemoStudent, rng, daysAgo } from './context';
import { ADMISSION_YEARS, BRANCHES, yearOfStudy } from './foundations';

const PER_SECTION = 15;

/**
 * The first 15 students of the cohort carry the risk story: seed-demo-ai
 * gives PROFILES[i] to pool[i], in insertion order. Each slot says where that
 * student sits (CSE years 2–4 are the faculty and HOD logins' sections) and
 * whether their signals need them in the hostel (warden or mess concern).
 * Keep in step with PROFILES in seed-demo-ai.ts.
 */
export const STORY_SLOTS: Array<{ branch: string; year: number; hostel: boolean; name: [string, string, 'male' | 'female'] }> = [
  { branch: 'CSE', year: 3, hostel: true, name: ['Sai Kiran', 'Bandaru', 'male'] },        // P1 first-gen: fees + attendance + warden
  { branch: 'CSE', year: 2, hostel: true, name: ['Meghana', 'Pulla', 'female'] },          // P1 backlog + fees + mess
  { branch: 'ECE', year: 3, hostel: true, name: ['Naveen', 'Gundu', 'male'] },             // P1 first-gen: scholarship + attendance + warden
  { branch: 'CSE', year: 2, hostel: false, name: ['Harshitha', 'Mekala', 'female'] },      // P1 failing + fees + counselling, no mentor
  { branch: 'MECH', year: 4, hostel: false, name: ['Rakesh', 'Thota', 'male'] },           // P2 failing + fees, untouched 18d
  { branch: 'CSE', year: 3, hostel: true, name: ['Divya', 'Kandula', 'female'] },          // P2 attendance + warden
  { branch: 'ECE', year: 2, hostel: true, name: ['Manoj', 'Ediga', 'male'] },              // P2 failing + mess
  { branch: 'CIVIL', year: 3, hostel: false, name: ['Swapna', 'Boda', 'female'] },         // P2 first-gen: attendance + messaging + counselling
  { branch: 'CSE', year: 2, hostel: false, name: ['Vinay', 'Kurra', 'male'] },             // P2 attendance + messaging
  { branch: 'ECE', year: 4, hostel: false, name: ['Tejaswini', 'Nalla', 'female'] },       // P3 attendance + messaging
  { branch: 'MECH', year: 2, hostel: true, name: ['Srikanth', 'Madiga', 'male'] },         // P3 backlog + mess
  { branch: 'CSE', year: 4, hostel: false, name: ['Keerthana', 'Vemula', 'female'] },      // P3 failing
  { branch: 'CIVIL', year: 2, hostel: false, name: ['Prudhvi', 'Addanki', 'male'] },       // P3 scholarship + attendance
  { branch: 'ECE', year: 1, hostel: false, name: ['Anusha', 'Kolli', 'female'] },          // P3 first-gen failing
  { branch: 'MECH', year: 3, hostel: true, name: ['Mahender', 'Pittala', 'male'] },        // P3 fees + mess
];

const MALE = ['Aditya', 'Akhil', 'Anirudh', 'Arjun', 'Bharath', 'Charan', 'Deepak', 'Ganesh', 'Hemanth', 'Jagadeesh', 'Karthik', 'Lokesh', 'Mahesh', 'Nikhil', 'Pavan', 'Praneeth', 'Rahul', 'Rohith', 'Sandeep', 'Shiva', 'Sravan', 'Suraj', 'Tarun', 'Uday', 'Varun', 'Vamsi', 'Yashwanth'];
const FEMALE = ['Akshaya', 'Bhavana', 'Chandana', 'Deepthi', 'Harika', 'Divyasri', 'Gayathri', 'Jahnavi', 'Kavya', 'Lahari', 'Manasa', 'Mounika', 'Navya', 'Pooja', 'Pranavi', 'Ramya', 'Sahithi', 'Sindhu', 'Sneha', 'Sowmya', 'Sravya', 'Supriya', 'Tejasri', 'Vaishnavi', 'Varsha'];
const SURNAMES = ['Reddy', 'Rao', 'Naidu', 'Goud', 'Chowdary', 'Varma', 'Yadav', 'Sharma', 'Kumar', 'Patel', 'Raju', 'Setty', 'Bairi', 'Chilukuri', 'Dasari', 'Gaddam', 'Jangam', 'Kasturi', 'Mamidi', 'Nimmala', 'Palla', 'Rachakonda', 'Samala', 'Tadi', 'Uppala', 'Yerra'];
const FATHER = ['Srinivas', 'Venkatesh', 'Ramesh', 'Narayana', 'Ravi', 'Prasad', 'Suresh', 'Krishna', 'Mallesh', 'Anjaiah', 'Satyanarayana', 'Raghu'];
const MOTHER = ['Lakshmi', 'Padma', 'Saraswathi', 'Vijaya', 'Sujatha', 'Anuradha', 'Radha', 'Kalyani', 'Sunitha', 'Jyothi'];
const OCCUPATIONS = ['Farmer', 'Government employee', 'Teacher', 'Small business owner', 'Private employee', 'Daily-wage worker', 'Auto driver', 'Shopkeeper'];
const LANGS = ['te', 'te', 'en', 'hi', 'te', 'en'];
const CHANNELS = ['whatsapp', 'whatsapp', 'sms', 'call', 'email'] as const;
const CONVENER_CATEGORY = ['OC', 'OC', 'OC', 'OC', 'BC-A', 'BC-B', 'BC-B', 'BC-D', 'BC-D', 'SC', 'SC', 'ST', 'EWS'];

interface Plan {
  branch: (typeof BRANCHES)[number];
  admissionYear: number;
  seq: number;
  story?: (typeof STORY_SLOTS)[number];
}

/** 4 branches × 4 years × 15, story students first. */
function plan(): Plan[] {
  const slots = [...STORY_SLOTS];
  const story: Plan[] = [];
  const rest: Plan[] = [];
  for (const branch of BRANCHES) {
    for (const admissionYear of ADMISSION_YEARS) {
      for (let seq = 1; seq <= PER_SECTION; seq++) {
        const i = slots.findIndex((s) => s.branch === branch.code && yearOfStudy(admissionYear) === s.year);
        if (i >= 0) {
          const s = slots.splice(i, 1)[0]!;
          story[STORY_SLOTS.indexOf(s)] = { branch, admissionYear, seq, story: s };
        } else {
          rest.push({ branch, admissionYear, seq });
        }
      }
    }
  }
  return [...story, ...rest];
}

export async function ensureStudents(ctx: DemoCtx): Promise<DemoStudent[]> {
  const cid = ctx.collegeId;
  const r = rng(20260930);
  const sections = await Section.find({ collegeId: cid, name: 'A', branchId: { $in: Object.values(ctx.branches) } }).select({ branchId: 1, batchId: 1 }).lean();
  const batches = await Batch.find({ collegeId: cid, programmeId: ctx.programmeId, admissionYear: { $in: [...ADMISSION_YEARS] } }).select({ admissionYear: 1 }).lean();
  const batchOf = (yr: number) => batches.find((b) => b.admissionYear === yr)!._id as Types.ObjectId;
  const sectionOf = (branch: string, yr: number) =>
    sections.find((s) => String(s.branchId) === String(ctx.branches[branch]) && String(s.batchId) === String(batchOf(yr)))!._id as Types.ObjectId;

  const out: DemoStudent[] = [];
  const toHostel: Array<{ id: Types.ObjectId; gender: string }> = [];
  let created = 0;
  for (const [n, p] of plan().entries()) {
    const rollNumber = `${String(p.admissionYear).slice(2)}B01A${p.branch.roll}${String(p.seq).padStart(2, '0')}`;
    const year = yearOfStudy(p.admissionYear);
    const sectionId = sectionOf(p.branch.code, p.admissionYear);

    // Names and attributes are drawn for every student, existing or not, so
    // the stream stays identical from run to run.
    const gender = p.story?.name[2] ?? (r.next() < 0.45 ? 'female' : 'male');
    const first = p.story?.name[0] ?? r.pick(gender === 'female' ? FEMALE : MALE);
    const last = p.story?.name[1] ?? r.pick(SURNAMES);
    const quota = r.next() < 0.3 ? 'management' : 'convener';
    const category = quota === 'management' ? 'OC' : r.pick(CONVENER_CATEGORY);
    const lang = r.pick(LANGS);
    const channel = r.pick(CHANNELS);
    const occupation = r.pick(OCCUPATIONS);
    const withMother = r.next() < 0.6;
    const fatherName = r.pick(FATHER);
    const motherName = r.pick(MOTHER);
    const hostel = p.story ? p.story.hostel : r.next() < 0.3;

    const existing = await Student.findOne({ collegeId: cid, rollNumber }).select({ personId: 1 }).lean();
    if (existing) {
      out.push({ _id: existing._id as Types.ObjectId, personId: existing.personId as Types.ObjectId, rollNumber, branch: p.branch.code, year, sectionId });
      continue;
    }

    const phone = `9${String(700000000 + n * 7919).padStart(9, '0')}`;
    const person = await Person.create({
      collegeId: cid, name: `${first} ${last}`, phone, gender, preferredLanguage: lang,
      email: `${first.toLowerCase().replace(/\s+/g, '.')}.${rollNumber.toLowerCase()}@jit.edu.in`,
      dob: new Date(p.admissionYear - 18, (n * 5) % 12, (n % 27) + 1),
      address: { city: r.pick(['Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam', 'Nalgonda', 'Guntur', 'Vijayawada']), state: 'Telangana' },
    });
    const student = await Student.create({
      collegeId: cid, personId: person._id, admissionYear: p.admissionYear, studyYearAtAdmission: 1,
      category, quota, regulationId: ctx.regulationId, programmeId: ctx.programmeId,
      branchId: ctx.branches[p.branch.code], batchId: batchOf(p.admissionYear), rollNumber,
      status: 'active', onboardingStatus: 'completed',
    });

    // Guardians: the father is fee-responsible and the primary contact.
    const fPerson = await Person.create({ collegeId: cid, name: `${fatherName} ${last}`, phone: `8${phone.slice(1)}`, gender: 'male', preferredLanguage: lang });
    const father = await Parent.create({
      collegeId: cid, personId: fPerson._id, relationship: 'father', linkedStudents: [student._id],
      primaryContact: true, isFeeResponsible: true, occupation, communicationPreference: channel,
      annualIncomeBand: occupation === 'Farmer' || occupation === 'Daily-wage worker' ? 'below_2_5_lakh' : '5_to_10_lakh',
    });
    if (withMother) {
      const mPerson = await Person.create({ collegeId: cid, name: `${motherName} ${last}`, phone: `7${phone.slice(1)}`, gender: 'female', preferredLanguage: lang });
      await Parent.create({ collegeId: cid, personId: mPerson._id, relationship: 'mother', linkedStudents: [student._id], communicationPreference: 'call' });
    }
    await Student.updateOne({ _id: student._id }, { $set: { primaryParentId: father._id, feeResponsibleParentId: father._id } });
    await Section.updateOne({ _id: sectionId }, { $addToSet: { studentIds: student._id } });
    if (hostel) toHostel.push({ id: student._id as Types.ObjectId, gender });

    out.push({ _id: student._id as Types.ObjectId, personId: person._id as Types.ObjectId, rollNumber, branch: p.branch.code, year, sectionId });
    created += 1;
  }

  // Hostel residents, by block gender. Allocations are only made for the
  // students created above, so a re-run adds nothing.
  const rooms = await HostelRoom.find({ collegeId: cid }).populate<{ blockId: { type: string } }>('blockId', 'type').select({ blockId: 1, capacity: 1 }).lean();
  const boys = rooms.filter((x) => x.blockId?.type === 'boys');
  const girls = rooms.filter((x) => x.blockId?.type === 'girls');
  let housed = 0;
  for (const [i, h] of toHostel.entries()) {
    const pool = h.gender === 'female' ? girls : boys;
    if (!pool.length) continue;
    await HostelAllocation.create({
      collegeId: cid, studentId: h.id, roomId: pool[i % pool.length]!._id, academicYearId: ctx.ayId,
      status: 'active', allocatedDate: daysAgo(75), allocationType: 'new_intake',
    });
    housed += 1;
  }

  ctx.log(`students: ${created} created (${out.length - created} already there), ${housed} in hostel, all 16 sections filled`);
  return out;
}
