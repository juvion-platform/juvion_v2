import { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStats, listPersons, deletePerson } from '../services/people';
import { Users, GraduationCap, Briefcase, UserCheck, Building2, Search, Trash2, Pencil, ChevronLeft, ChevronRight, IdCard } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import DataTable from '../components/ui/DataTable';

import StudentsPage from './people/StudentsPage';
import FacultyPage from './people/FacultyPage';
import StaffPage from './people/StaffPage';
import StudentFormPage from './people/StudentFormPage';
import FacultyFormPage from './people/FacultyFormPage';
import StaffFormPage from './people/StaffFormPage';
import ParentsPage from './people/ParentsPage';
import OrganizationsPage from './people/OrganizationsPage';
import StudentDetailPage from './people/StudentDetailPage';
import FacultyDetailPage from './people/FacultyDetailPage';
import FacultyDocumentQueuePage from './people/FacultyDocumentQueuePage';
import StaffDetailPage from './people/StaffDetailPage';
import ParentDetailPage from './people/ParentDetailPage';
import PersonaCatalogPage from './people/PersonaCatalogPage';

const CARDS = [
  { to: 'students', icon: GraduationCap, label: 'Students', desc: 'Student profiles & enrollment', iconBg: 'bg-primary-50 text-primary-600', border: 'border-primary-200 hover:border-primary-400', statKey: 'students' },
  { to: 'faculty', icon: Users, label: 'Faculty', desc: 'Teaching staff & workload', iconBg: 'bg-accent-50 text-accent-500', border: 'border-accent-200 hover:border-accent-400', statKey: 'faculty' },
  { to: 'staff', icon: Briefcase, label: 'Staff', desc: 'Non-teaching staff', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'staff' },
  { to: 'parents', icon: UserCheck, label: 'Parents', desc: 'Guardian profiles & contacts', iconBg: 'bg-orange-50 text-orange-500', border: 'border-orange-200 hover:border-orange-400', statKey: 'parents' },
  { to: 'organizations', icon: Building2, label: 'Organizations', desc: 'Partner & external orgs', iconBg: 'bg-primary-100 text-primary-700', border: 'border-primary-200 hover:border-primary-400', statKey: 'organizations' },
  { to: 'personas', icon: IdCard, label: 'Persona Catalog', desc: 'Canonical persona/sub-persona codes', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'personas' },
];

const ROLE_ROUTE: Record<string, string> = {
  Student: 'students',
  Faculty: 'faculty',
  Staff: 'staff',
  Parent: 'parents',
  Organization: 'organizations',
};

const ROLE_STYLE: Record<string, string> = {
  Student: 'bg-primary-50 text-primary-700 hover:bg-primary-100',
  Faculty: 'bg-accent-50 text-accent-600 hover:bg-accent-100',
  Staff: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
  Parent: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
};

function PeopleHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: stats } = useQuery({ queryKey: ['people-stats'], queryFn: getStats });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: personsData, isLoading } = useQuery({
    queryKey: ['persons', page, search],
    queryFn: () => listPersons(page, 15, search || undefined),
  });

  const deleteMut = useMutation({
    mutationFn: deletePerson,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['persons'] }); qc.invalidateQueries({ queryKey: ['people-stats'] }); },
  });

  function goToEdit(role: { type: string; recordId: string }) {
    const route = ROLE_ROUTE[role.type];
    if (route) navigate(`/people/${route}/${role.recordId}/edit`);
  }

  // Row click → detail page for the person's primary role. For multi-role
  // people we pick the first role (ordering reflects server-side priority).
  // Unlinked persons (no roles) and Organizations (no detail page yet) are
  // silent no-ops; the pencil buttons in the actions column are still
  // available for edit access in those cases.
  function goToDetail(person: any) {
    const primary = person.roles?.[0];
    if (!primary) return;
    const route = ROLE_ROUTE[primary.type];
    if (!route) return;
    // Organizations have no detail page yet; skip.
    if (primary.type === 'Organization') return;
    navigate(`/people/${route}/${primary.recordId}`);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => (
      <span className="font-medium text-navy">{r.name}</span>
    )},
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (r: any) => r.email || <span className="text-gray-400">—</span> },
    { key: 'roles', label: 'Type', render: (r: any) => (
      <div className="flex flex-wrap gap-1">
        {r.roles?.length > 0
          ? r.roles.map((role: any) => (
              <span key={role.type} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLE[role.type] || 'bg-gray-100 text-gray-600'}`}>
                {role.type}
              </span>
            ))
          : <span className="text-gray-400 text-xs">Unlinked</span>
        }
      </div>
    )},
    { key: 'gender', label: 'Gender', render: (r: any) => r.gender ? <span className="capitalize">{r.gender}</span> : <span className="text-gray-400">—</span> },
    { key: 'createdAt', label: 'Added', render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        {r.roles?.map((role: any) => (
          <button key={role.type} onClick={(e) => { e.stopPropagation(); goToEdit(role); }} className="p-1.5 rounded hover:bg-amber-50" title={`Edit ${role.type}`}>
            <Pencil size={15} className="text-amber-500" />
          </button>
        ))}
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this person? This will not delete linked student/faculty/staff records.')) deleteMut.mutate(r._id); }} className="p-1.5 rounded hover:bg-red-50" title="Delete">
          <Trash2 size={15} className="text-red-500" />
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">People</h2>

      {/* Category tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {CARDS.map(card => {
          const Icon = card.icon;
          const count = stats ? (stats as any)[card.statKey] : '—';
          return (
            <button
              key={card.to}
              onClick={() => navigate(card.to)}
              className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}
            >
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}>
                <Icon size={22} />
              </div>
              <div className="text-2xl font-bold text-navy mb-1">{count}</div>
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* All Persons list */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-navy">All Persons</h3>
          <div className="flex gap-3 items-center">
            <span className="text-sm text-gray-400">{personsData?.total ?? 0} total</span>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
              <input
                placeholder="Search by name..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 pr-3 py-2 border rounded-lg text-sm w-52 focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none"
              />
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={personsData?.items || []}
          loading={isLoading}
          rowKey={(r: any) => r._id}
          onRowClick={goToDetail}
          rowClickable={(r: any) => {
            // Only show clickable affordance for people with a role that
            // has a detail page. Unlinked persons and org-only rows are
            // excluded so the hover/cursor state stays honest.
            const primary = r.roles?.[0];
            return Boolean(primary && primary.type !== 'Organization' && ROLE_ROUTE[primary.type]);
          }}
        />

        {personsData && personsData.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t">
            <span className="text-sm text-gray-500">
              Page {page} of {personsData.pages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft size={14} className="text-primary-500" /> Prev
              </button>
              <button
                disabled={page >= personsData.pages}
                onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Next <ChevronRight size={14} className="text-primary-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SubPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Breadcrumbs className="mb-4" />
      {children}
    </div>
  );
}

export default function People() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<PeopleHome />} />
        {/* Students */}
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/new" element={<StudentFormPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="students/:id/edit" element={<StudentFormPage />} />
        {/* Faculty */}
        <Route path="faculty" element={<FacultyPage />} />
        <Route path="faculty/new" element={<FacultyFormPage />} />
        {/* Static "queue" path BEFORE :id, otherwise React Router would
            match "/people/faculty/document-queue" as :id="document-queue". */}
        <Route path="faculty/document-queue" element={<FacultyDocumentQueuePage />} />
        <Route path="faculty/:id" element={<FacultyDetailPage />} />
        <Route path="faculty/:id/edit" element={<FacultyFormPage />} />
        {/* Staff */}
        <Route path="staff" element={<StaffPage />} />
        <Route path="staff/new" element={<StaffFormPage />} />
        <Route path="staff/:id" element={<StaffDetailPage />} />
        <Route path="staff/:id/edit" element={<StaffFormPage />} />
        {/* Parents — detail has inline edit (no separate form route) */}
        <Route path="parents" element={<ParentsPage />} />
        <Route path="parents/:id" element={<ParentDetailPage />} />
        {/* Organizations */}
        <Route path="organizations" element={<OrganizationsPage />} />
        {/* Strategic Gap 7 — Persona Catalog (read-only reference) */}
        <Route path="personas" element={<PersonaCatalogPage />} />
      </Routes>
    </SubPageWrapper>
  );
}
