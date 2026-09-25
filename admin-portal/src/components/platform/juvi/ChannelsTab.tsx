import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listChannels, listTemplates } from '../../../services/juvi-app';

export default function ChannelsTab() {
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const channels = useQuery({ queryKey: ['juvi-channels', status], queryFn: () => listChannels(status, 1, 100) });
  const templates = useQuery({ queryKey: ['juvi-templates'], queryFn: listTemplates });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy">Channels <span className="text-gray-500 font-normal text-sm">· {channels.data?.total ?? 0}</span></h3>
          <div className="inline-flex rounded-lg border overflow-hidden text-sm">
            {(['active', 'archived'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={`px-3 py-1.5 capitalize ${status === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Template</th><th className="px-4 py-2">Replies</th><th className="px-4 py-2">Priority</th><th className="px-4 py-2 text-right">Members</th></tr>
            </thead>
            <tbody>
              {channels.data?.items.map((c) => (
                <tr key={c._id} className="border-t">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 capitalize">{c.templateCode}</td>
                  <td className="px-4 py-2">{c.replyRule === 'allowed' ? 'Allowed' : 'Announcement only'}</td>
                  <td className="px-4 py-2 capitalize">{c.defaultPriority}</td>
                  <td className="px-4 py-2 text-right">{c.memberCount}</td>
                </tr>
              ))}
              {channels.data && channels.data.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No {status} channels. Channels are created by the reconcile job from your ERP structure.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-navy">Templates</h3>
        <p className="text-sm text-gray-500">Templates are read-only in this release; editing with a channel preview arrives with the admin configuration sub-project.</p>
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">Name pattern</th><th className="px-4 py-2">Scope</th><th className="px-4 py-2">Replies</th><th className="px-4 py-2">Priority</th><th className="px-4 py-2">Archive</th></tr>
            </thead>
            <tbody>
              {templates.data?.items.map((t) => (
                <tr key={t.code} className="border-t">
                  <td className="px-4 py-2 capitalize">{t.code}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.namePattern}</td>
                  <td className="px-4 py-2">{t.scopeType.replace('_', ' ')}</td>
                  <td className="px-4 py-2">{t.replyRule === 'allowed' ? 'Allowed' : 'Announcement only'}</td>
                  <td className="px-4 py-2 capitalize">{t.defaultPriority}</td>
                  <td className="px-4 py-2">{t.archiveRule === 'never' ? 'Never' : 'On semester end'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
