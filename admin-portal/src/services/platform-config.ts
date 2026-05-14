import api from './api';

const BASE = '/platform/config';

// ─── Wire types — mirror backend config-registry.ts ──────────────

export type ConfigFieldType =
  | 'string'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'date';

export type ConfigCardinality = 'single' | 'multi';

export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  helpText?: string;
  default?: unknown;
  options?: ConfigFieldOption[];
  placeholder?: string;
}

export interface ConfigSchema {
  type: string;
  label: string;
  description: string;
  cardinality: ConfigCardinality;
  identifierField?: string;
  fields: ConfigField[];
}

export interface ConfigEntry {
  _id?: string;
  collegeId?: string;
  configType: string;
  identifier: string;
  values: Record<string, unknown>;
  label?: string;
  enabled: boolean;
  /** Synthetic flag — set by backend when returning a default-only
   *  view of a single-cardinality type with no DB row yet. */
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

// ─── Client ─────────────────────────────────────────────────────

export const listConfigTypes = (): Promise<{ types: ConfigSchema[] }> =>
  api.get(`${BASE}/types`).then((r) => r.data);

export const getConfigSchema = (type: string): Promise<ConfigSchema> =>
  api.get(`${BASE}/${type}/schema`).then((r) => r.data);

export const listConfigEntries = (type: string): Promise<{ entries: ConfigEntry[] }> =>
  api.get(`${BASE}/${type}`).then((r) => r.data);

export const getConfigEntry = (type: string, identifier?: string): Promise<ConfigEntry> => {
  const url = identifier ? `${BASE}/${type}/${identifier}` : `${BASE}/${type}`;
  return api.get(url).then((r) => r.data);
};

export const upsertConfigEntry = (
  type: string,
  body: { values: Record<string, unknown>; label?: string; enabled?: boolean },
  identifier?: string,
): Promise<ConfigEntry> => {
  const url = identifier ? `${BASE}/${type}/${identifier}` : `${BASE}/${type}`;
  return api.put(url, body).then((r) => r.data);
};

export const deleteConfigEntry = (
  type: string,
  identifier: string,
): Promise<{ deleted: true }> =>
  api.delete(`${BASE}/${type}/${identifier}`).then((r) => r.data);

// ─── Strategic Gap 8 — ERPNext / Frappe HR bridge ─────────────────

export interface ERPNextMapping {
  juvionEvent: string;
  erpnextDocType: string;
  method: 'POST' | 'PUT';
  defaultEnabled: boolean;
  description: string;
}

export interface ERPNextBridgeConfig {
  _id?: string;
  collegeId?: string;
  enabled: boolean;
  baseUrl?: string;
  apiKeyRef?: string;
  siteName?: string;
  enabledChannels: string[];
  lastSyncAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  failureCount: number;
  successCount: number;
  outboundEnabled: boolean;
}

export interface ERPNextStatus {
  config: ERPNextBridgeConfig;
  mappings: ERPNextMapping[];
  recent: Array<{
    _id: string;
    provider: string;
    endpoint: string;
    method: string;
    status: string;
    error?: string;
    startedAt: string;
    completedAt?: string;
  }>;
  phaseANote?: string;
}

export const getERPNextStatus = (): Promise<ERPNextStatus> =>
  api.get('/platform/integrations/erpnext').then((r) => r.data);

export const updateERPNextConfig = (patch: Partial<ERPNextBridgeConfig>): Promise<ERPNextBridgeConfig> =>
  api.put('/platform/integrations/erpnext', patch).then((r) => r.data);

export const testERPNextConnection = (): Promise<{ ok: boolean; reason: string; message: string }> =>
  api.post('/platform/integrations/erpnext/test').then((r) => r.data);
