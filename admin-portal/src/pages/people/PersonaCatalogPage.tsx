import { useQuery } from '@tanstack/react-query';
import { listPersonas, type PersonaDescriptor } from '../../services/people';
import Badge from '../../components/ui/Badge';
import { Users, ChevronRight } from 'lucide-react';

// Strategic Gap 7 — canonical persona catalog browser.
// Read-only admin reference for "which personaType strings does the
// platform understand?". Source-of-truth is `backend/src/shared/rbac/
// personas.ts` exposed via `GET /api/people/personas`.

function tierBadge(tier: 1 | 2 | 3) {
  if (tier === 1) return <Badge variant="info">L1 family</Badge>;
  if (tier === 2) return <Badge variant="warning">L2 operational</Badge>;
  return <Badge variant="success">L3 sub-persona</Badge>;
}

function PersonaRow({ p, depth = 0 }: { p: PersonaDescriptor; depth?: number }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ paddingLeft: depth * 24 }}>
      {depth > 0 && <ChevronRight size={14} className="text-gray-300 mt-1 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{p.code}</span>
          <span className="font-medium text-gray-900">{p.label}</span>
          {tierBadge(p.tier)}
          <span className="text-xs text-gray-400">→ {p.primaryModule}</span>
        </div>
        <p className="text-sm text-gray-600 mt-1">{p.description}</p>
        {p.permissionsHint && (
          <p className="text-xs text-gray-500 mt-1 italic">{p.permissionsHint}</p>
        )}
      </div>
    </div>
  );
}

export default function PersonaCatalogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['persona-catalog'],
    queryFn: listPersonas,
  });

  // Group by family with L3 children nested under their L1/L2 parent.
  const families = (data?.l1_l2 || []).map((parent) => ({
    parent,
    children: (data?.l3 || []).filter((c) => c.parentCode === parent.code || c.family === parent.code),
  }));

  // L3 personas with parents NOT in the L1/L2 list (e.g. ST-RES-COORD whose
  // family is itself) need their own "loose" group at the bottom.
  const orphanL3 = (data?.l3 || []).filter((c) => {
    return !families.some((f) => f.children.some((cc) => cc.code === c.code));
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="rounded-lg p-2.5 bg-indigo-50 text-indigo-600"><Users size={20} /></div>
        <div>
          <h2 className="text-xl font-bold text-navy">Persona Catalog</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Canonical persona codes the platform understands. RBAC engine matches `prefix-*` wildcards — L3 sub-personas inherit from their L1/L2 parent unless an L3-specific policy is declared.
          </p>
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-400">Loading…</div>}

      {!isLoading && (
        <div className="space-y-4">
          {families.map(({ parent, children }) => (
            <div key={parent.code} className="bg-white rounded-xl border shadow-sm p-5">
              <PersonaRow p={parent} />
              {children.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                  {children.map((c) => <PersonaRow key={c.code} p={c} depth={1} />)}
                </div>
              )}
            </div>
          ))}

          {orphanL3.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Other L3 Sub-Personas</h3>
              <div className="space-y-1">
                {orphanL3.map((c) => <PersonaRow key={c.code} p={c} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
