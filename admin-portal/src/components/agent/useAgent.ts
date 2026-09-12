/**
 * React Query wiring for the agent endpoints — keys and defaults in one
 * place so a widget's cache and the page's "refresh all" cannot disagree.
 */
import { useState } from 'react';
import { useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';

import {
  getForecastNarrative,
  getReminderDrafts,
  getRiskScores,
  getSituations,
  type ForecastWithNarrative,
  type ReminderDraft,
  type RiskScoresResponse,
  type SituationsResponse,
} from '../../services/finance-agent';

const AGENT_STALE_MS = 5 * 60 * 1000;

export const agentKeys = {
  forecast: (monthIso: string) => ['fee-forecast', monthIso] as const,
  situations: ['situations'] as const,
  riskScores: (idsKey: string) => ['risk-scores', idsKey] as const,
  riskNarrative: (studentId: string) => ['risk-narrative', studentId] as const,
  reminderDrafts: (idsKey: string) => ['reminder-drafts', idsKey] as const,
};

export function useForecast(monthAnchor: Date) {
  return useQuery<ForecastWithNarrative>({
    queryKey: agentKeys.forecast(monthAnchor.toISOString()),
    queryFn: () => getForecastNarrative(monthAnchor),
    staleTime: AGENT_STALE_MS,
    retry: false,
  });
}

export function useSituations(enabled: boolean) {
  return useQuery<SituationsResponse>({
    queryKey: agentKeys.situations,
    queryFn: () => getSituations(),
    staleTime: AGENT_STALE_MS,
    retry: false,
    enabled,
  });
}

export function useRiskScores(studentIds: string[], enabled: boolean) {
  return useQuery<RiskScoresResponse>({
    queryKey: agentKeys.riskScores(studentIds.join(',')),
    queryFn: () => getRiskScores(studentIds, false),
    enabled: enabled && studentIds.length > 0,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

/** Lazy per-student narrative — only fires once the badge has been hovered. */
export function useRiskNarrative(studentId: string, enabled: boolean) {
  return useQuery<string | null>({
    queryKey: agentKeys.riskNarrative(studentId),
    queryFn: async () => (await getRiskScores([studentId], true)).scores[0]?.narrative ?? null,
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useReminderDrafts(studentIds: string[], enabled: boolean) {
  return useQuery<ReminderDraft[]>({
    queryKey: agentKeys.reminderDrafts(studentIds.join(',')),
    queryFn: () => getReminderDrafts(studentIds),
    enabled: enabled && studentIds.length > 0,
    staleTime: AGENT_STALE_MS,
    retry: false,
  });
}

/**
 * `force=true` bypasses the server's daily Redis cache; the fresh result is
 * written straight into the query cache. On failure the key is invalidated
 * so the normal fetch path shows the error.
 */
export function forceInto<T>(qc: QueryClient, key: QueryKey, fetcher: () => Promise<T>): Promise<void> {
  return fetcher()
    .then((result) => { qc.setQueryData<T>(key, result); })
    .catch(() => { void qc.invalidateQueries({ queryKey: key }); });
}

export function useForceRefresh<T>(key: QueryKey, fetcher: () => Promise<T>) {
  const qc = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const run = () => {
    setIsRefreshing(true);
    void forceInto(qc, key, fetcher).finally(() => setIsRefreshing(false));
  };
  return { run, isRefreshing };
}
