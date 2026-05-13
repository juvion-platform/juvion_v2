/**
 * FacultyTeachingPanel — Phase D sub-collections panel.
 *
 * Three stacked sections under a single panel: Subjects taught,
 * Research scholars guided, Books authored. Each section is a
 * compact list + "Add" button; each row has Edit / Archive
 * actions. Edits go through a modal scoped per row.
 *
 * Why one component for three entities: their shapes differ enough
 * that the form fields are per-entity, but the list rendering and
 * modal scaffolding are identical. Combining them keeps the FacultyDetailPage
 * tabbing simple (one Teaching & Research tab instead of three) and
 * the panel stays the only place the operator scans for "what's this
 * faculty member doing besides documents."
 *
 * NAAC criteria covered:
 *   - Subjects taught → 2.2 / 2.6
 *   - Research scholars → 3.4.2
 *   - Books → 3.3
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, GraduationCap, BookText, Plus, Pencil, Trash2, Loader2,
  AlertCircle,
} from 'lucide-react';

import Modal from '../ui/Modal';
import {
  listFacultySubjects, createFacultySubject, updateFacultySubject, archiveFacultySubject,
  listFacultyScholars, createFacultyScholar, updateFacultyScholar, archiveFacultyScholar,
  listFacultyBooks, createFacultyBook, updateFacultyBook, archiveFacultyBook,
  FacultySubjectAssignmentDoc, FacultyResearchScholarDoc, FacultyBookDoc,
  FacultySubjectRole, FacultySubjectStatus,
  FacultyResearchScholarType, FacultyResearchScholarStatus,
  FacultyBookRole, FacultyBookType, FacultyBookLevel,
} from '../../services/faculty-teaching';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700';
const lbl = 'block text-xs font-medium text-gray-700 mb-1';

// ─── Vocabularies ─────────────────────────────────────────────────

const SUBJECT_ROLES: ReadonlyArray<FacultySubjectRole> = ['instructor', 'co_instructor', 'lab_incharge', 'tutorial'];
const SUBJECT_STATUSES: ReadonlyArray<FacultySubjectStatus> = ['planned', 'active', 'completed'];

const SCHOLAR_TYPES: ReadonlyArray<FacultyResearchScholarType> = ['phd', 'mtech', 'mphil', 'undergrad_project'];
const SCHOLAR_STATUSES: ReadonlyArray<FacultyResearchScholarStatus> = ['ongoing', 'completed', 'discontinued', 'awarded'];

const BOOK_ROLES: ReadonlyArray<FacultyBookRole> = ['author', 'co_author', 'editor', 'co_editor', 'translator'];
const BOOK_TYPES: ReadonlyArray<FacultyBookType> = ['textbook', 'monograph', 'edited_volume', 'chapter'];
const BOOK_LEVELS: ReadonlyArray<FacultyBookLevel> = ['international', 'national', 'regional'];

const STATUS_PILL: Record<string, string> = {
  active:        'bg-emerald-50 text-emerald-800 border-emerald-200',
  planned:       'bg-blue-50 text-blue-800 border-blue-200',
  completed:     'bg-slate-50 text-slate-700 border-slate-200',
  ongoing:       'bg-blue-50 text-blue-800 border-blue-200',
  discontinued:  'bg-red-50 text-red-800 border-red-200',
  awarded:       'bg-emerald-50 text-emerald-800 border-emerald-200',
};

function StatusPill({ value }: { value: string }) {
  const cls = STATUS_PILL[value] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Top-level panel ──────────────────────────────────────────────

interface FacultyTeachingPanelProps {
  facultyId: string;
}

export default function FacultyTeachingPanel({ facultyId }: FacultyTeachingPanelProps) {
  return (
    <div className="space-y-4">
      <SubjectsSection facultyId={facultyId} />
      <ScholarsSection facultyId={facultyId} />
      <BooksSection facultyId={facultyId} />
    </div>
  );
}

// ─── Subjects taught ──────────────────────────────────────────────

function SubjectsSection({ facultyId }: { facultyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['faculty-subjects', facultyId],
    queryFn: () => listFacultySubjects(facultyId),
    enabled: !!facultyId,
  });
  const items = data?.items ?? [];
  const [editing, setEditing] = useState<FacultySubjectAssignmentDoc | null | undefined>(undefined);
  // editing semantics: `undefined` = closed, `null` = create mode, `doc` = edit.

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveFacultySubject(facultyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faculty-subjects', facultyId] }),
  });

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <SectionHeader
        Icon={BookOpen}
        title="Subjects taught"
        helper="NAAC 2.2 / 2.6 — workload & student-teacher ratio evidence."
        count={items.length}
        onAdd={() => setEditing(null)}
      />
      <div className="p-4">
        {isLoading && <LoadingRow />}
        {!isLoading && items.length === 0 && (
          <EmptyRow text="No subjects recorded yet." />
        )}
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="font-medium pb-1">Subject</th>
                <th className="font-medium pb-1">AY / Sem</th>
                <th className="font-medium pb-1">Role</th>
                <th className="font-medium pb-1">Students</th>
                <th className="font-medium pb-1">Status</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id} className="border-t border-gray-100">
                  <td className="py-1.5">
                    <div className="font-mono text-xs text-gray-500">{row.subjectCode}</div>
                    <div className="font-medium text-gray-800">{row.subjectName}</div>
                  </td>
                  <td className="py-1.5 text-xs text-gray-700">
                    {row.academicYear}{row.semester ? ` · Sem ${row.semester}` : ''}
                  </td>
                  <td className="py-1.5 text-xs capitalize">{row.role.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 text-xs">{row.studentCount ?? '—'}</td>
                  <td className="py-1.5"><StatusPill value={row.status} /></td>
                  <td className="py-1.5 text-right">
                    <RowActions onEdit={() => setEditing(row)} onArchive={() => archiveMut.mutate(row._id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing !== undefined && (
        <SubjectModal
          facultyId={facultyId}
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['faculty-subjects', facultyId] });
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}

interface SubjectForm {
  subjectCode: string;
  subjectName: string;
  academicYear: string;
  semester: string;
  role: FacultySubjectRole;
  weeklyHours: string;
  studentCount: string;
  status: FacultySubjectStatus;
  notes: string;
}

function SubjectModal({
  facultyId, existing, onClose, onSaved,
}: {
  facultyId: string;
  existing: FacultySubjectAssignmentDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SubjectForm>({
    subjectCode: existing?.subjectCode ?? '',
    subjectName: existing?.subjectName ?? '',
    academicYear: existing?.academicYear ?? `${new Date().getFullYear()}-${String((new Date().getFullYear() + 1) % 100).padStart(2, '0')}`,
    semester: existing?.semester !== undefined ? String(existing.semester) : '',
    role: existing?.role ?? 'instructor',
    weeklyHours: existing?.weeklyHours !== undefined ? String(existing.weeklyHours) : '',
    studentCount: existing?.studentCount !== undefined ? String(existing.studentCount) : '',
    status: existing?.status ?? 'active',
    notes: existing?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Partial<FacultySubjectAssignmentDoc> = {
        subjectCode: form.subjectCode.trim(),
        subjectName: form.subjectName.trim(),
        academicYear: form.academicYear.trim(),
        role: form.role,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };
      if (form.semester) payload.semester = Number(form.semester);
      if (form.weeklyHours) payload.weeklyHours = Number(form.weeklyHours);
      if (form.studentCount) payload.studentCount = Number(form.studentCount);
      return existing
        ? updateFacultySubject(facultyId, existing._id, payload)
        : createFacultySubject(facultyId, payload);
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Save failed'),
  });

  return (
    <Modal open={true} onClose={onClose} title={existing ? 'Edit subject' : 'Add subject taught'}>
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Subject code <span className="text-red-500">*</span></label>
            <input required value={form.subjectCode} onChange={(e) => setForm((f) => ({ ...f, subjectCode: e.target.value }))} className={inp} placeholder="e.g. CS302" />
          </div>
          <div>
            <label className={lbl}>Subject name <span className="text-red-500">*</span></label>
            <input required value={form.subjectName} onChange={(e) => setForm((f) => ({ ...f, subjectName: e.target.value }))} className={inp} placeholder="e.g. Operating Systems" />
          </div>
          <div>
            <label className={lbl}>Academic year <span className="text-red-500">*</span></label>
            <input required value={form.academicYear} onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))} className={inp} placeholder="2025-26" />
          </div>
          <div>
            <label className={lbl}>Semester</label>
            <input value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))} className={inp} placeholder="1-8" />
          </div>
          <div>
            <label className={lbl}>Role</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as FacultySubjectRole }))} className={inp}>
              {SUBJECT_ROLES.map((r) => <option key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FacultySubjectStatus }))} className={inp}>
              {SUBJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Weekly hours</label>
            <input value={form.weeklyHours} onChange={(e) => setForm((f) => ({ ...f, weeklyHours: e.target.value }))} className={inp} placeholder="e.g. 4" />
          </div>
          <div>
            <label className={lbl}>Student count</label>
            <input value={form.studentCount} onChange={(e) => setForm((f) => ({ ...f, studentCount: e.target.value }))} className={inp} placeholder="e.g. 62" />
          </div>
        </div>
        <div>
          <label className={lbl}>Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inp + ' min-h-[60px]'} rows={2} />
        </div>
        <ModalFooter onClose={onClose} saving={saveMut.isPending} error={error} isEdit={!!existing} />
      </form>
    </Modal>
  );
}

// ─── Research scholars ────────────────────────────────────────────

function ScholarsSection({ facultyId }: { facultyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['faculty-scholars', facultyId],
    queryFn: () => listFacultyScholars(facultyId),
    enabled: !!facultyId,
  });
  const items = data?.items ?? [];
  const [editing, setEditing] = useState<FacultyResearchScholarDoc | null | undefined>(undefined);

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveFacultyScholar(facultyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faculty-scholars', facultyId] }),
  });

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <SectionHeader
        Icon={GraduationCap}
        title="Research scholars guided"
        helper="NAAC 3.4.2 — PhDs, M.Tech, M.Phil, and undergrad projects under this faculty."
        count={items.length}
        onAdd={() => setEditing(null)}
      />
      <div className="p-4">
        {isLoading && <LoadingRow />}
        {!isLoading && items.length === 0 && <EmptyRow text="No research scholars recorded yet." />}
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="font-medium pb-1">Scholar</th>
                <th className="font-medium pb-1">Type</th>
                <th className="font-medium pb-1">Topic</th>
                <th className="font-medium pb-1">Years</th>
                <th className="font-medium pb-1">Status</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id} className="border-t border-gray-100">
                  <td className="py-1.5 font-medium text-gray-800">{row.scholarName}</td>
                  <td className="py-1.5 text-xs uppercase font-mono">{row.scholarType}</td>
                  <td className="py-1.5 text-xs text-gray-700 max-w-xs">{row.topic}</td>
                  <td className="py-1.5 text-xs">
                    {row.registrationYear}
                    {row.completionYear ? ` – ${row.completionYear}` : ' – present'}
                  </td>
                  <td className="py-1.5"><StatusPill value={row.status} /></td>
                  <td className="py-1.5 text-right">
                    <RowActions onEdit={() => setEditing(row)} onArchive={() => archiveMut.mutate(row._id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing !== undefined && (
        <ScholarModal
          facultyId={facultyId}
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['faculty-scholars', facultyId] });
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}

interface ScholarForm {
  scholarName: string;
  scholarType: FacultyResearchScholarType;
  topic: string;
  registrationYear: string;
  completionYear: string;
  status: FacultyResearchScholarStatus;
  coGuide: string;
  university: string;
  thesisLink: string;
  notes: string;
}

function ScholarModal({
  facultyId, existing, onClose, onSaved,
}: {
  facultyId: string;
  existing: FacultyResearchScholarDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ScholarForm>({
    scholarName: existing?.scholarName ?? '',
    scholarType: existing?.scholarType ?? 'phd',
    topic: existing?.topic ?? '',
    registrationYear: existing?.registrationYear !== undefined ? String(existing.registrationYear) : String(new Date().getFullYear()),
    completionYear: existing?.completionYear !== undefined ? String(existing.completionYear) : '',
    status: existing?.status ?? 'ongoing',
    coGuide: existing?.coGuide ?? '',
    university: existing?.university ?? '',
    thesisLink: existing?.thesisLink ?? '',
    notes: existing?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Partial<FacultyResearchScholarDoc> = {
        scholarName: form.scholarName.trim(),
        scholarType: form.scholarType,
        topic: form.topic.trim(),
        registrationYear: Number(form.registrationYear),
        status: form.status,
        coGuide: form.coGuide.trim() || undefined,
        university: form.university.trim() || undefined,
        thesisLink: form.thesisLink.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (form.completionYear) payload.completionYear = Number(form.completionYear);
      return existing
        ? updateFacultyScholar(facultyId, existing._id, payload)
        : createFacultyScholar(facultyId, payload);
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Save failed'),
  });

  return (
    <Modal open={true} onClose={onClose} title={existing ? 'Edit scholar' : 'Add research scholar'}>
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Scholar name <span className="text-red-500">*</span></label>
            <input required value={form.scholarName} onChange={(e) => setForm((f) => ({ ...f, scholarName: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Type</label>
            <select value={form.scholarType} onChange={(e) => setForm((f) => ({ ...f, scholarType: e.target.value as FacultyResearchScholarType }))} className={inp}>
              {SCHOLAR_TYPES.map((s) => <option key={s} value={s} className="uppercase">{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Topic <span className="text-red-500">*</span></label>
            <input required value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} className={inp} placeholder="Thesis title / project topic" />
          </div>
          <div>
            <label className={lbl}>Registration year <span className="text-red-500">*</span></label>
            <input required value={form.registrationYear} onChange={(e) => setForm((f) => ({ ...f, registrationYear: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Completion year</label>
            <input value={form.completionYear} onChange={(e) => setForm((f) => ({ ...f, completionYear: e.target.value }))} className={inp} placeholder="Empty if ongoing" />
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FacultyResearchScholarStatus }))} className={inp}>
              {SCHOLAR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Co-guide (optional)</label>
            <input value={form.coGuide} onChange={(e) => setForm((f) => ({ ...f, coGuide: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>University / institute</label>
            <input value={form.university} onChange={(e) => setForm((f) => ({ ...f, university: e.target.value }))} className={inp} placeholder="Default: this institution" />
          </div>
          <div>
            <label className={lbl}>Thesis link</label>
            <input value={form.thesisLink} onChange={(e) => setForm((f) => ({ ...f, thesisLink: e.target.value }))} className={inp} placeholder="Shodhganga URL" />
          </div>
        </div>
        <div>
          <label className={lbl}>Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inp + ' min-h-[60px]'} rows={2} />
        </div>
        <ModalFooter onClose={onClose} saving={saveMut.isPending} error={error} isEdit={!!existing} />
      </form>
    </Modal>
  );
}

// ─── Books ────────────────────────────────────────────────────────

function BooksSection({ facultyId }: { facultyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['faculty-books', facultyId],
    queryFn: () => listFacultyBooks(facultyId),
    enabled: !!facultyId,
  });
  const items = data?.items ?? [];
  const [editing, setEditing] = useState<FacultyBookDoc | null | undefined>(undefined);

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveFacultyBook(facultyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faculty-books', facultyId] }),
  });

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <SectionHeader
        Icon={BookText}
        title="Books authored / edited"
        helper="NAAC 3.3 — books and chapters in edited volumes published per teacher."
        count={items.length}
        onAdd={() => setEditing(null)}
      />
      <div className="p-4">
        {isLoading && <LoadingRow />}
        {!isLoading && items.length === 0 && <EmptyRow text="No books recorded yet." />}
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="font-medium pb-1">Title</th>
                <th className="font-medium pb-1">Role / Type</th>
                <th className="font-medium pb-1">Publisher</th>
                <th className="font-medium pb-1">Year</th>
                <th className="font-medium pb-1">Level</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id} className="border-t border-gray-100">
                  <td className="py-1.5">
                    <div className="font-medium text-gray-800">{row.title}</div>
                    {row.isbn && <div className="text-[10px] text-gray-500 font-mono">ISBN {row.isbn}</div>}
                  </td>
                  <td className="py-1.5 text-xs capitalize">
                    {row.role.replace(/_/g, ' ')}
                    <span className="mx-1 text-gray-400">·</span>
                    <span className="text-gray-600">{row.bookType.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="py-1.5 text-xs text-gray-700">{row.publisher}</td>
                  <td className="py-1.5 text-xs">{row.year}</td>
                  <td className="py-1.5 text-xs capitalize">{row.level}</td>
                  <td className="py-1.5 text-right">
                    <RowActions onEdit={() => setEditing(row)} onArchive={() => archiveMut.mutate(row._id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing !== undefined && (
        <BookModal
          facultyId={facultyId}
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['faculty-books', facultyId] });
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}

interface BookForm {
  title: string;
  role: FacultyBookRole;
  bookType: FacultyBookType;
  publisher: string;
  isbn: string;
  year: string;
  edition: string;
  pages: string;
  level: FacultyBookLevel;
  coAuthors: string;
  doi: string;
  notes: string;
}

function BookModal({
  facultyId, existing, onClose, onSaved,
}: {
  facultyId: string;
  existing: FacultyBookDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BookForm>({
    title: existing?.title ?? '',
    role: existing?.role ?? 'author',
    bookType: existing?.bookType ?? 'textbook',
    publisher: existing?.publisher ?? '',
    isbn: existing?.isbn ?? '',
    year: existing?.year !== undefined ? String(existing.year) : String(new Date().getFullYear()),
    edition: existing?.edition ?? '',
    pages: existing?.pages !== undefined ? String(existing.pages) : '',
    level: existing?.level ?? 'national',
    coAuthors: existing?.coAuthors ?? '',
    doi: existing?.doi ?? '',
    notes: existing?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Partial<FacultyBookDoc> = {
        title: form.title.trim(),
        role: form.role,
        bookType: form.bookType,
        publisher: form.publisher.trim(),
        year: Number(form.year),
        level: form.level,
        isbn: form.isbn.trim() || undefined,
        edition: form.edition.trim() || undefined,
        coAuthors: form.coAuthors.trim() || undefined,
        doi: form.doi.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (form.pages) payload.pages = Number(form.pages);
      return existing
        ? updateFacultyBook(facultyId, existing._id, payload)
        : createFacultyBook(facultyId, payload);
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Save failed'),
  });

  return (
    <Modal open={true} onClose={onClose} title={existing ? 'Edit book' : 'Add book / chapter'} widthClass="max-w-2xl">
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={lbl}>Title <span className="text-red-500">*</span></label>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Role</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as FacultyBookRole }))} className={inp}>
              {BOOK_ROLES.map((r) => <option key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Type</label>
            <select value={form.bookType} onChange={(e) => setForm((f) => ({ ...f, bookType: e.target.value as FacultyBookType }))} className={inp}>
              {BOOK_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Publisher <span className="text-red-500">*</span></label>
            <input required value={form.publisher} onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Year <span className="text-red-500">*</span></label>
            <input required value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>ISBN</label>
            <input value={form.isbn} onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))} className={inp} placeholder="978-..." />
          </div>
          <div>
            <label className={lbl}>Edition</label>
            <input value={form.edition} onChange={(e) => setForm((f) => ({ ...f, edition: e.target.value }))} className={inp} placeholder="1st / 2nd / …" />
          </div>
          <div>
            <label className={lbl}>Pages</label>
            <input value={form.pages} onChange={(e) => setForm((f) => ({ ...f, pages: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Level</label>
            <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as FacultyBookLevel }))} className={inp}>
              {BOOK_LEVELS.map((l) => <option key={l} value={l} className="capitalize">{l}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Co-authors / co-editors</label>
            <input value={form.coAuthors} onChange={(e) => setForm((f) => ({ ...f, coAuthors: e.target.value }))} className={inp} placeholder="Comma-separated names" />
          </div>
          <div className="col-span-2">
            <label className={lbl}>DOI / link</label>
            <input value={form.doi} onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value }))} className={inp} placeholder="https://doi.org/..." />
          </div>
        </div>
        <div>
          <label className={lbl}>Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inp + ' min-h-[60px]'} rows={2} />
        </div>
        <ModalFooter onClose={onClose} saving={saveMut.isPending} error={error} isEdit={!!existing} />
      </form>
    </Modal>
  );
}

// ─── Shared row chrome ────────────────────────────────────────────

function SectionHeader({
  Icon, title, helper, count, onAdd,
}: {
  Icon: typeof BookOpen;
  title: string;
  helper: string;
  count: number;
  onAdd: () => void;
}) {
  return (
    <div className="px-5 py-3 border-b bg-navy/[0.03] flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-navy-dark text-sm flex items-center gap-2">
          <Icon size={15} className="text-navy/70" />
          {title}
          {count > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-100 text-primary-800 border border-primary-200">
              {count}
            </span>
          )}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">{helper}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded border border-primary-200"
      >
        <Plus size={12} /> Add
      </button>
    </div>
  );
}

function RowActions({ onEdit, onArchive }: { onEdit: () => void; onArchive: () => void }) {
  return (
    <div className="flex gap-1 justify-end">
      <button
        type="button"
        onClick={onEdit}
        className="p-1 rounded hover:bg-amber-50 text-amber-600"
        title="Edit"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm('Archive this entry?')) onArchive();
        }}
        className="p-1 rounded hover:bg-red-50 text-red-600"
        title="Archive"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
      <Loader2 size={14} className="animate-spin" /> Loading…
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="text-sm text-gray-500 italic py-2">{text}</div>;
}

function ModalFooter({
  onClose, saving, error, isEdit,
}: {
  onClose: () => void;
  saving: boolean;
  error: string | null;
  isEdit: boolean;
}) {
  return (
    <>
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-start gap-1.5">
          <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </>
  );
}
