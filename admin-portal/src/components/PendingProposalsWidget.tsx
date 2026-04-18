/**
 * T19: Dashboard widget that surfaces pending campus-service proposals
 * to the student. Renders only when there are proposed allocations
 * (for either hostel or transport) awaiting their response.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Home, Bus, ChevronRight } from 'lucide-react';
import { listMyHostelAllocations, listMyTransportAllocations } from '../services/campus-allocations';

export default function PendingProposalsWidget() {
  const hostelQ = useQuery({ queryKey: ['my-hostel-allocations'], queryFn: listMyHostelAllocations });
  const transportQ = useQuery({ queryKey: ['my-transport-allocations'], queryFn: listMyTransportAllocations });

  const hostelPending = hostelQ.data?.pendingCount ?? 0;
  const transportPending = transportQ.data?.pendingCount ?? 0;
  const total = hostelPending + transportPending;

  if (total === 0) return null;

  return (
    <Link
      to="/campus/my-services"
      className="block bg-amber-50 border-l-4 border-amber-400 rounded-lg p-4 hover:bg-amber-100 transition"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-amber-900">
            You have {total} pending campus service {total === 1 ? 'proposal' : 'proposals'}
          </div>
          <div className="text-sm text-amber-700 flex items-center gap-3 mt-1">
            {hostelPending > 0 && (
              <span className="inline-flex items-center gap-1"><Home size={14} /> {hostelPending} hostel</span>
            )}
            {transportPending > 0 && (
              <span className="inline-flex items-center gap-1"><Bus size={14} /> {transportPending} transport</span>
            )}
          </div>
        </div>
        <ChevronRight className="text-amber-600" size={20} />
      </div>
    </Link>
  );
}
