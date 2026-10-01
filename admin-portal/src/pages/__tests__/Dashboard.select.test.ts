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
  it('selects role-specific widgets for Accounts persona', () => {
    const accWidgets = [W('finance-kpi', 'finance'), W('finance-card', 'finance'), W('academics-card', 'academics')];
    const canAcc = (m: string) => m === 'finance';
    const pinned = ['finance-kpi', 'finance-card'];
    expect(selectWidgets(accWidgets, canAcc, 'finance', pinned).map((w) => w.id)).toEqual(['finance-kpi', 'finance-card']);
  });
  it('selects role-specific widgets for Faculty persona', () => {
    const facWidgets = [W('academics-kpi', 'academics'), W('academics-card', 'academics'), W('student-dev-card', 'student-dev'), W('finance-card', 'finance')];
    const canFac = (m: string) => ['academics', 'student-dev'].includes(m);
    const pinned = ['academics-kpi', 'academics-card', 'student-dev-card'];
    expect(selectWidgets(facWidgets, canFac, 'academics', pinned).map((w) => w.id)).toEqual(['academics-kpi', 'academics-card', 'student-dev-card']);
  });
  it('selects role-specific widgets for HOD persona', () => {
    const hodWidgets = [W('people-kpi', 'people'), W('academics-kpi', 'academics'), W('academics-card', 'academics'), W('finance-card', 'finance')];
    const canHod = (m: string) => ['people', 'academics'].includes(m);
    const pinned = ['people-kpi', 'academics-kpi', 'academics-card'];
    expect(selectWidgets(hodWidgets, canHod, 'academics', pinned).map((w) => w.id)).toEqual(['people-kpi', 'academics-kpi', 'academics-card']);
  });
});

