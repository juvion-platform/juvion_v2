import { describe, it, expect } from 'vitest';
import { selectWidgets } from '../Dashboard';
import type { DashboardWidget } from '../../dashboard/registry';

const W = (id: string, module: string | null): DashboardWidget => ({ id, module, title: id, kind: 'card', Component: () => null });
const widgets = [W('proposals', null), W('people-kpi', 'people'), W('finance-card', 'finance'), W('academics-card', 'academics')];

describe('selectWidgets', () => {
  const can = (m: string) => ['people', 'academics'].includes(m);
  it('keeps only readable widgets, ungated ones always', () => {
    expect(selectWidgets(widgets, can).map((w) => w.id)).toEqual(['proposals', 'people-kpi', 'academics-card']);
  });
  it('puts the primary persona home module first', () => {
    expect(selectWidgets(widgets, can, 'academics').map((w) => w.id)).toEqual(['academics-card', 'proposals', 'people-kpi']);
  });
  it('a pinned list wins, still filtered by permission', () => {
    expect(selectWidgets(widgets, can, 'academics', ['finance-card', 'people-kpi', 'nope']).map((w) => w.id)).toEqual(['people-kpi']);
  });
  it('an empty pinned list means unset, not "nothing"', () => {
    expect(selectWidgets(widgets, can, 'academics', []).map((w) => w.id)).toEqual(['academics-card', 'proposals', 'people-kpi']);
  });
});
