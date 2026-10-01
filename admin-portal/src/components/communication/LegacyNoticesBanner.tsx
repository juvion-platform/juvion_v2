import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

/**
 * Spec §1, §8: the Announcements and Circulars pages stay, and say where
 * official notices go now. Nothing is migrated.
 */
export default function LegacyNoticesBanner({ kind }: { kind: 'announcements' | 'circulars' }) {
  const canRead = useAuthStore((s) => s.hasPermission('notices', 'read'));
  return (
    <div role="note" className="mb-4 flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <Megaphone size={18} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
      <p>
        <span className="font-semibold">Official notices now go to Juvi.</span>{' '}
        These {kind} are kept as records, but they do not reach anyone&apos;s phone.{' '}
        {canRead
          ? <Link to="/communication/notices" className="font-medium underline">Go to Notices</Link>
          : 'Ask your college office to publish it as a Juvi notice.'}
      </p>
    </div>
  );
}
