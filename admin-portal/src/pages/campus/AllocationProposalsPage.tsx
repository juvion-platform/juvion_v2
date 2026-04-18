/**
 * T16 + T17: Admin page for hostel + transport allocation proposals.
 *
 * Unified view because the two flows are structurally identical and
 * wardens/transport officers usually want to see capacity-by-status at a
 * glance. Tabs switch between hostel and transport.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listHostelAllocations, listTransportAllocations, listHostelRooms, listTransportRoutes } from '../../services/welfare';
import { listStudents } from '../../services/people';
import { listAcademicYears } from '../../services/academics';
import {
  proposeHostelAllocation, withdrawHostelAllocation, promoteHostelAllocation,
  approveVacateHostelAllocation, rejectVacateHostelAllocation,
  proposeTransportAllocation, withdrawTransportAllocation, promoteTransportAllocation,
  approveCancelTransportAllocation, rejectCancelTransportAllocation,
} from '../../services/campus-allocations';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';
const btn = 'px-3 py-1.5 rounded-md text-sm font-medium';
const btnP = `${btn} bg-primary-500 text-white hover:bg-primary-600`;
const btnS = `${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`;
const btnD = `${btn} bg-red-500 text-white hover:bg-red-600`;

type Flow = 'hostel' | 'transport';

const STATUS_COLOR: Record<string, string> = {
  proposed: 'warning', waitlisted: 'default', active: 'success',
  vacate_requested: 'warning', vacated: 'default', cancelled: 'default',
  declined: 'danger', withdrawn: 'danger', expired: 'danger', transferred: 'default',
};

export default function AllocationProposalsPage() {
  const [flow, setFlow] = useState<Flow>('hostel');
  const [statusFilter, setStatusFilter] = useState<string>('live');
  const [proposeOpen, setProposeOpen] = useState(false);
  const [reasonModal, setReasonModal] = useState<{ id: string; action: string } | null>(null);
  const [reason, setReason] = useState('');
  const qc = useQueryClient();

  const hostelQ = useQuery({ queryKey: ['hostel-allocations', 'all'], queryFn: () => listHostelAllocations(1, 200), enabled: flow === 'hostel' });
  const transportQ = useQuery({ queryKey: ['transport-allocations', 'all'], queryFn: () => listTransportAllocations(1, 200), enabled: flow === 'transport' });

  const items: any[] = useMemo(() => {
    const all = (flow === 'hostel' ? hostelQ.data?.items : transportQ.data?.items) || [];
    if (statusFilter === 'all') return all;
    if (statusFilter === 'live') return all.filter((a: any) => ['proposed', 'waitlisted', 'active', 'vacate_requested'].includes(a.status));
    return all.filter((a: any) => a.status === statusFilter);
  }, [flow, statusFilter, hostelQ.data, transportQ.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hostel-allocations'] });
    qc.invalidateQueries({ queryKey: ['transport-allocations'] });
  };

  const withdrawMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      flow === 'hostel' ? withdrawHostelAllocation(id, reason) : withdrawTransportAllocation(id, reason),
    onSuccess: () => { invalidate(); setReasonModal(null); setReason(''); },
  });
  const promoteMut = useMutation({
    mutationFn: (id: string) =>
      flow === 'hostel' ? promoteHostelAllocation(id) : promoteTransportAllocation(id),
    onSuccess: invalidate,
  });
  const approveMut = useMutation({
    mutationFn: (id: string) =>
      flow === 'hostel' ? approveVacateHostelAllocation(id) : approveCancelTransportAllocation(id),
    onSuccess: invalidate,
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      flow === 'hostel' ? rejectVacateHostelAllocation(id, reason) : rejectCancelTransportAllocation(id, reason),
    onSuccess: () => { invalidate(); setReasonModal(null); setReason(''); },
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Allocation Proposals</h1>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setFlow('hostel')} className={flow === 'hostel' ? btnP : btnS}>Hostel</button>
        <button onClick={() => setFlow('transport')} className={flow === 'transport' ? btnP : btnS}>Transport</button>
        <div className="flex-1" />
        <button onClick={() => setProposeOpen(true)} className={btnP}>+ Propose New</button>
      </div>

      <div className="flex gap-2 mb-4 text-sm">
        {['live', 'proposed', 'waitlisted', 'active', 'vacate_requested', 'declined', 'withdrawn', 'expired', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2 py-1 rounded ${statusFilter === s ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">{flow === 'hostel' ? 'Room' : 'Route / Stop'}</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Proposed</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a._id} className="border-t">
                <td className="px-4 py-2">{a.studentId?.rollNumber ?? a.studentId?._id?.slice(-6) ?? a.studentId?.slice?.(-6) ?? '—'}</td>
                <td className="px-4 py-2">
                  {flow === 'hostel'
                    ? (a.roomId?.roomNumber ?? a.roomId?._id?.slice(-6) ?? '—')
                    : `${a.routeId?.name ?? a.routeId?._id?.slice(-6) ?? '—'} / ${a.stopName ?? ''}`}
                </td>
                <td className="px-4 py-2"><Badge variant={STATUS_COLOR[a.status]}>{a.status}</Badge></td>
                <td className="px-4 py-2">{a.proposedAt ? new Date(a.proposedAt).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2">{a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  {(a.status === 'proposed' || a.status === 'waitlisted') && (
                    <button onClick={() => setReasonModal({ id: a._id, action: 'withdraw' })} className={btnD}>Withdraw</button>
                  )}
                  {a.status === 'waitlisted' && (
                    <button onClick={() => promoteMut.mutate(a._id)} className={btnP}>Promote</button>
                  )}
                  {a.status === 'vacate_requested' && (
                    <>
                      <button onClick={() => approveMut.mutate(a._id)} className={btnP}>Approve Vacate</button>
                      <button onClick={() => setReasonModal({ id: a._id, action: 'reject' })} className={btnD}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No allocations match the selected filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {proposeOpen && (
        <ProposeModal
          flow={flow}
          onClose={() => setProposeOpen(false)}
          onSuccess={invalidate}
        />
      )}

      {reasonModal && (
        <Modal open onClose={() => { setReasonModal(null); setReason(''); }} title={`${reasonModal.action === 'withdraw' ? 'Withdraw proposal' : 'Reject vacate'}`}>
          <div className="p-4 space-y-3">
            <label className={lbl}>Reason</label>
            <textarea className={inp} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <div className="flex gap-2 justify-end">
              <button className={btnS} onClick={() => { setReasonModal(null); setReason(''); }}>Cancel</button>
              <button
                className={btnD}
                onClick={() => {
                  if (!reason.trim()) return;
                  if (reasonModal.action === 'withdraw') {
                    withdrawMut.mutate({ id: reasonModal.id, reason });
                  } else {
                    rejectMut.mutate({ id: reasonModal.id, reason });
                  }
                }}
                disabled={!reason.trim()}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Propose modal ──────────────────────────────────────────

function ProposeModal({ flow, onClose, onSuccess }: { flow: Flow; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<any>({
    studentId: '', academicYearId: '',
    ...(flow === 'hostel' ? { roomId: '' } : { routeId: '', stopName: '' }),
    forceWaitlist: false,
  });
  const [capacityError, setCapacityError] = useState(false);
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 500) });
  const { data: ayData } = useQuery({ queryKey: ['academicYears', 'all'], queryFn: () => listAcademicYears(1, 100) });
  const { data: roomsData } = useQuery({ queryKey: ['hostel-rooms', 'all'], queryFn: () => listHostelRooms(1, 500), enabled: flow === 'hostel' });
  const { data: routesData } = useQuery({ queryKey: ['transport-routes', 'all'], queryFn: () => listTransportRoutes(1, 500), enabled: flow === 'transport' });

  const mut = useMutation({
    mutationFn: () => flow === 'hostel' ? proposeHostelAllocation(form) : proposeTransportAllocation(form),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: any) => {
      if (err?.response?.status === 409 && /capacity_full/.test(err?.response?.data?.error || '')) {
        setCapacityError(true);
      }
    },
  });

  const selectedRoute = (routesData?.items || []).find((r: any) => r._id === form.routeId);

  return (
    <Modal open onClose={onClose} title={`Propose ${flow} allocation`}>
      <div className="p-4 space-y-3">
        <div>
          <label className={lbl}>Student</label>
          <select className={inp} value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
            <option value="">— select —</option>
            {(studentsData?.items || []).map((s: any) => (
              <option key={s._id} value={s._id}>{s.rollNumber ?? s._id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Academic Year</label>
          <select className={inp} value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}>
            <option value="">— select —</option>
            {(ayData?.items || []).map((y: any) => (
              <option key={y._id} value={y._id}>{y.label ?? y._id}</option>
            ))}
          </select>
        </div>
        {flow === 'hostel' ? (
          <div>
            <label className={lbl}>Room</label>
            <select className={inp} value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">— select —</option>
              {(roomsData?.items || []).map((r: any) => (
                <option key={r._id} value={r._id}>{r.roomNumber} (cap {r.currentOccupancy}/{r.capacity})</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className={lbl}>Route</label>
              <select className={inp} value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value, stopName: '' })}>
                <option value="">— select —</option>
                {(routesData?.items || []).map((r: any) => (
                  <option key={r._id} value={r._id}>{r.name} (seats {r.currentRidership}/{r.capacity})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Stop</label>
              <select className={inp} value={form.stopName} onChange={(e) => setForm({ ...form, stopName: e.target.value })}>
                <option value="">— select —</option>
                {(selectedRoute?.stops || []).map((s: any) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {capacityError && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            Capacity full. You can still add this student to the waitlist.
            <div className="mt-2 flex gap-2">
              <button className={btnS} onClick={onClose}>Cancel</button>
              <button className={btnP} onClick={() => mut.mutate(undefined, { onSuccess: () => { onSuccess(); onClose(); } })}>Wait, let me retry</button>
              <button className={btnP} onClick={() => { setForm({ ...form, forceWaitlist: true }); setCapacityError(false); mut.mutate(); }}>Add to waitlist</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button className={btnS} onClick={onClose}>Cancel</button>
          <button className={btnP} onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? 'Proposing…' : 'Propose'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
