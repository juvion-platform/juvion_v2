/**
 * T18: Student "My Campus Services" page.
 *
 * Shows pending proposals at the top with Accept/Decline buttons, active
 * services (hostel + transport) below with a "Request to Vacate" action,
 * and a History tab listing all prior allocations.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMyHostelAllocations, listMyTransportAllocations,
  acceptHostelAllocation, declineHostelAllocation, requestVacateHostelAllocation,
  acceptTransportAllocation, declineTransportAllocation, requestCancelTransportAllocation,
} from '../../services/campus-allocations';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-200';
const btnP = 'px-3 py-1.5 rounded-md text-sm font-medium bg-primary-500 text-white hover:bg-primary-600';
const btnS = 'px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200';
const btnD = 'px-3 py-1.5 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600';

type Flow = 'hostel' | 'transport';

export default function MyCampusServicesPage() {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [reasonModal, setReasonModal] = useState<{ id: string; flow: Flow; action: 'decline' | 'vacate' } | null>(null);
  const [reason, setReason] = useState('');
  const qc = useQueryClient();

  const hostelQ = useQuery({ queryKey: ['my-hostel-allocations'], queryFn: listMyHostelAllocations });
  const transportQ = useQuery({ queryKey: ['my-transport-allocations'], queryFn: listMyTransportAllocations });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-hostel-allocations'] });
    qc.invalidateQueries({ queryKey: ['my-transport-allocations'] });
  };

  const acceptMut = useMutation({
    mutationFn: ({ id, flow }: { id: string; flow: Flow }) =>
      flow === 'hostel' ? acceptHostelAllocation(id) : acceptTransportAllocation(id),
    onSuccess: invalidate,
  });
  const declineMut = useMutation({
    mutationFn: ({ id, flow, reason }: { id: string; flow: Flow; reason: string }) =>
      flow === 'hostel' ? declineHostelAllocation(id, reason) : declineTransportAllocation(id, reason),
    onSuccess: () => { invalidate(); setReasonModal(null); setReason(''); },
  });
  const vacateMut = useMutation({
    mutationFn: ({ id, flow, reason }: { id: string; flow: Flow; reason: string }) =>
      flow === 'hostel' ? requestVacateHostelAllocation(id, reason) : requestCancelTransportAllocation(id, reason),
    onSuccess: () => { invalidate(); setReasonModal(null); setReason(''); },
  });

  const hostelItems = hostelQ.data?.items ?? [];
  const transportItems = transportQ.data?.items ?? [];

  const pending = [
    ...hostelItems.filter((a) => a.status === 'proposed').map((a) => ({ ...a, flow: 'hostel' as Flow })),
    ...transportItems.filter((a) => a.status === 'proposed').map((a) => ({ ...a, flow: 'transport' as Flow })),
  ];
  const active = [
    ...hostelItems.filter((a) => a.status === 'active').map((a) => ({ ...a, flow: 'hostel' as Flow })),
    ...transportItems.filter((a) => a.status === 'active').map((a) => ({ ...a, flow: 'transport' as Flow })),
  ];
  const history = [
    ...hostelItems.filter((a) => !['proposed', 'active'].includes(a.status)).map((a) => ({ ...a, flow: 'hostel' as Flow })),
    ...transportItems.filter((a) => !['proposed', 'active'].includes(a.status)).map((a) => ({ ...a, flow: 'transport' as Flow })),
  ].sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">My Campus Services</h1>

      {/* Pending Proposals */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Pending Proposals</h2>
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p._id} className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-400">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {p.flow === 'hostel' ? 'Hostel allocation' : 'Transport allocation'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {p.flow === 'hostel'
                        ? `Room: ${p.roomId ?? '—'}`
                        : `Route: ${p.routeId ?? '—'} • Stop: ${p.stopName ?? '—'}`}
                    </div>
                    {p.expiresAt && (
                      <div className="text-xs text-amber-700 mt-1">
                        Respond by {new Date(p.expiresAt).toLocaleDateString()} ({daysUntil(p.expiresAt)})
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className={btnP} onClick={() => acceptMut.mutate({ id: p._id, flow: p.flow })}>Accept</button>
                    <button className={btnS} onClick={() => setReasonModal({ id: p._id, flow: p.flow, action: 'decline' })}>Decline</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button onClick={() => setTab('active')} className={`px-4 py-2 text-sm font-medium ${tab === 'active' ? 'border-b-2 border-primary-500 text-primary-700' : 'text-gray-600'}`}>
          Active services ({active.length})
        </button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 text-sm font-medium ${tab === 'history' ? 'border-b-2 border-primary-500 text-primary-700' : 'text-gray-600'}`}>
          History ({history.length})
        </button>
      </div>

      {tab === 'active' && (
        <div className="space-y-3">
          {active.length === 0 && <p className="text-sm text-gray-500">No active campus services.</p>}
          {active.map((a) => (
            <div key={a._id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{a.flow === 'hostel' ? 'Hostel' : 'Transport'}</div>
                <div className="text-sm text-gray-600">
                  {a.flow === 'hostel'
                    ? `Room: ${a.roomId ?? '—'}`
                    : `Route: ${a.routeId ?? '—'} • Stop: ${a.stopName ?? '—'}`}
                </div>
                <Badge variant="success">{a.status}</Badge>
              </div>
              <button className={btnD} onClick={() => setReasonModal({ id: a._id, flow: a.flow, action: 'vacate' })}>
                {a.flow === 'hostel' ? 'Request to vacate' : 'Request to cancel'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 && <p className="text-sm text-gray-500">No history yet.</p>}
          {history.map((h) => (
            <div key={h._id} className="bg-white rounded-lg shadow p-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{h.flow === 'hostel' ? 'Hostel' : 'Transport'}</span>
                <span className="text-gray-500 ml-2">{new Date(h.createdAt).toLocaleDateString()}</span>
              </div>
              <Badge variant="default">{h.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {reasonModal && (
        <Modal open onClose={() => { setReasonModal(null); setReason(''); }} title={reasonModal.action === 'decline' ? 'Decline proposal' : 'Request to vacate'}>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Reason (optional)</label>
            <textarea className={inp} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <div className="flex gap-2 justify-end">
              <button className={btnS} onClick={() => { setReasonModal(null); setReason(''); }}>Cancel</button>
              <button
                className={reasonModal.action === 'decline' ? btnD : btnP}
                onClick={() => {
                  if (reasonModal.action === 'decline') {
                    declineMut.mutate({ id: reasonModal.id, flow: reasonModal.flow, reason });
                  } else {
                    vacateMut.mutate({ id: reasonModal.id, flow: reasonModal.flow, reason });
                  }
                }}
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

function daysUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / 86400_000);
  if (days <= 0) return 'expires today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}
