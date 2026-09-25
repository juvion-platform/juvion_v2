import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { DASHBOARD_WIDGETS, type DashboardWidget } from '../dashboard/registry';
import { listPersonas as listPlatformPersonas } from '../services/personas';
import { listPersonas as listPeoplePersonas } from '../services/people';

/**
 * 010 — the page is the registry filtered by permission and ordered by the
 * primary persona's home module. A persona may pin an explicit widget list.
 */
export function selectWidgets(
  widgets: DashboardWidget[],
  can: (module: string, action: string, subDomain?: string) => boolean,
  primaryModule?: string,
  pinned?: string[],
): DashboardWidget[] {
  if (pinned && pinned.length > 0) {
    return pinned.map((id) => widgets.find((w) => w.id === id)).filter((w): w is DashboardWidget => !!w && (!w.module || can(w.module, 'read', w.subDomain)));
  }
  const visible = widgets.filter((w) => !w.module || can(w.module, 'read', w.subDomain));
  if (!primaryModule) return visible;
  // Stable partition: home-module widgets first, everything else in registry order.
  return [...visible.filter((w) => w.module === primaryModule), ...visible.filter((w) => w.module !== primaryModule)];
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const permissions = useAuthStore((s) => s.permissions);
  const canPlatform = hasPermission('platform', 'read');
  const canPeople = hasPermission('people', 'read');

  const { data: personaRows } = useQuery({
    queryKey: ['dashboard-personas', canPlatform, canPeople],
    queryFn: async () => {
      if (canPlatform) return listPlatformPersonas();
      if (canPeople) return (await listPeoplePersonas()).all as { code: string; primaryModule: string; dashboardWidgets?: string[] }[];
      return [];
    },
    enabled: canPlatform || canPeople,
    retry: false,
  });
  const primary = personaRows?.find((p) => p.code === user?.personaType);
  const widgets = useMemo(
    () => selectWidgets(DASHBOARD_WIDGETS, hasPermission, primary?.primaryModule, primary?.dashboardWidgets ?? undefined),
    // `permissions` is a dependency so a policy refresh re-runs the selection.
    [hasPermission, primary, permissions],
  );

  const kpis = widgets.filter((w) => w.kind === 'kpi');
  const banners = widgets.filter((w) => w.kind === 'banner');
  const cards = widgets.filter((w) => w.kind === 'card');

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Dashboard</h2>

      {banners.filter((w) => w.id === 'pending-proposals').map((w) => <div key={w.id} className="mb-6"><w.Component /></div>)}

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((w) => <w.Component key={w.id} />)}
        </div>
      )}

      {banners.filter((w) => w.id !== 'pending-proposals').map((w) => <div key={w.id} className="mt-8"><w.Component /></div>)}

      {cards.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((w) => <w.Component key={w.id} />)}
        </div>
      )}

      {widgets.length === 0 && (
        <p className="text-sm text-gray-500">Nothing to show yet. Ask your administrator to assign a persona with dashboard access.</p>
      )}
    </div>
  );
}
