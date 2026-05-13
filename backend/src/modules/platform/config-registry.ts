/**
 * config-registry — runtime configuration schemas. Strategic Gap 3.
 *
 * Each registered config type is described by a `ConfigSchema`: a list
 * of fields (with type + required + options), a cardinality (single
 * per college vs multi-record catalog), and an optional identifier
 * field for multi-cardinality types.
 *
 * Adding a new config surface is a single registry entry. The generic
 * service stores the values in ConfigEntry, the generic controller
 * exposes them at `/platform/config/:type`, and the generic frontend
 * page reads the schema + renders the form automatically.
 *
 * Phase A ships two types:
 *   - `institution-feature-flags`   (single per college, all booleans)
 *   - `notification-templates`      (multi per college, code-keyed)
 */

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
  /** Wire key — also the JSON key inside `ConfigEntry.values`. */
  key: string;
  /** Human-readable label rendered above the input. */
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  /** Inline help text shown beneath the input. */
  helpText?: string;
  /** Default value used when the form opens for a new entry. */
  default?: unknown;
  /** Options for `select` and `multiselect` types. */
  options?: ConfigFieldOption[];
  /** Free-form placeholder text. */
  placeholder?: string;
}

export interface ConfigSchema {
  type: string;
  label: string;
  description: string;
  cardinality: ConfigCardinality;
  /** Required for multi-cardinality. The field within `values` that
   *  acts as the admin-set unique key (e.g. template `code`). */
  identifierField?: string;
  fields: ConfigField[];
}

// ─── Registered schemas ───────────────────────────────────────────

const institutionFeatureFlags: ConfigSchema = {
  type: 'institution-feature-flags',
  label: 'Institution Feature Flags',
  description:
    'Per-college toggles that turn major modules and behaviours on or off. Overlays the env-var defaults at runtime.',
  cardinality: 'single',
  fields: [
    {
      key: 'optionalAllotmentProposals',
      label: 'Optional Allotment Proposals',
      type: 'boolean',
      default: false,
      helpText:
        'When ON, hostel and transport allocations require admin-propose → student-accept. When OFF, the legacy auto-allocate path runs.',
    },
    {
      key: 'emailNotifications',
      label: 'Email Notifications',
      type: 'boolean',
      default: false,
      helpText: 'Produce email-channel notifications alongside in-app ones for lifecycle events.',
    },
    {
      key: 'smsNotifications',
      label: 'SMS Notifications',
      type: 'boolean',
      default: false,
      helpText: 'Produce SMS-channel notifications alongside in-app ones (requires SMS provider credentials).',
    },
    {
      key: 'whatsappNotifications',
      label: 'WhatsApp Notifications',
      type: 'boolean',
      default: false,
      helpText: 'Produce WhatsApp-channel notifications alongside in-app ones (requires WhatsApp provider).',
    },
    {
      key: 'juviAiSuggestions',
      label: 'Juvi AI Suggestions',
      type: 'boolean',
      default: true,
      helpText: 'Surface Juvi AI suggestions in operator workflows (lead scoring, eligibility checks, etc.).',
    },
    {
      key: 'parentPortal',
      label: 'Parent Portal',
      type: 'boolean',
      default: false,
      helpText: 'Expose the parent-facing portal for fee status, attendance, grades.',
    },
    {
      key: 'financeBlocksExams',
      label: 'Finance Blocks Exams',
      type: 'boolean',
      default: false,
      helpText:
        'When ON, the BlockedStudent state from M04 Finance blocks exam sittings in M03. Mirrors a CampX cross-app workflow.',
    },
    {
      key: 'bulkImportPortal',
      label: 'Bulk Import Portal',
      type: 'boolean',
      default: true,
      helpText: 'Expose the M12 schema-driven bulk-import surface to admins.',
    },
  ],
};

const notificationTemplates: ConfigSchema = {
  type: 'notification-templates',
  label: 'Notification Templates',
  description:
    'Reusable email / SMS / WhatsApp / in-app templates referenced at send time. Variables use `{{double-curly}}` placeholders (resolved by the communication service when the template fires).',
  cardinality: 'multi',
  identifierField: 'code',
  fields: [
    {
      key: 'code',
      label: 'Template Code',
      type: 'string',
      required: true,
      placeholder: 'e.g. fee_due_reminder',
      helpText: 'Stable machine-readable identifier referenced from the codebase. Lowercase + underscores.',
    },
    {
      key: 'name',
      label: 'Template Name',
      type: 'string',
      required: true,
      placeholder: 'Fee Due Reminder',
    },
    {
      key: 'channel',
      label: 'Channel',
      type: 'select',
      required: true,
      default: 'email',
      options: [
        { value: 'email', label: 'Email' },
        { value: 'sms', label: 'SMS' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'app', label: 'In-App' },
      ],
    },
    {
      key: 'subject',
      label: 'Subject',
      type: 'string',
      placeholder: 'Fee due in {{daysRemaining}} days',
      helpText: 'Optional. Used for email and in-app channels.',
    },
    {
      key: 'body',
      label: 'Body',
      type: 'textarea',
      required: true,
      placeholder: 'Dear {{studentName}}, your {{feeCategory}} fee of ₹{{amount}} is due on {{dueDate}}…',
      helpText: 'Plain text or HTML (email) / 160-char body (SMS). Use {{variable}} placeholders.',
    },
    {
      key: 'audience',
      label: 'Audience',
      type: 'select',
      default: 'student',
      options: [
        { value: 'student', label: 'Student' },
        { value: 'parent', label: 'Parent' },
        { value: 'faculty', label: 'Faculty' },
        { value: 'staff', label: 'Staff' },
      ],
    },
  ],
};

export const CONFIG_REGISTRY: readonly ConfigSchema[] = [
  institutionFeatureFlags,
  notificationTemplates,
];

const CONFIG_INDEX = new Map<string, ConfigSchema>(
  CONFIG_REGISTRY.map((s) => [s.type, s]),
);

export function getRegisteredSchema(type: string): ConfigSchema | null {
  return CONFIG_INDEX.get(type) || null;
}

export function listRegisteredSchemas(): ConfigSchema[] {
  return [...CONFIG_REGISTRY];
}

// ─── Validation against a registered schema ───────────────────────

export interface ValidationFailure {
  field: string;
  reason: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationFailure[];
  /** Coerced values (booleans, numbers, etc.) for the storage write. */
  values: Record<string, unknown>;
}

/**
 * Validate `input` against the registered schema's field list. Coerces
 * primitives (boolean from string, number from string), enforces
 * required, enforces enum membership for select fields. Multiselect
 * accepts string[] only.
 *
 * Unknown keys in `input` are silently dropped — same defensive
 * behaviour Zod gives us elsewhere, so an out-of-date frontend can't
 * smuggle in random fields.
 */
export function validateAgainstSchema(
  schema: ConfigSchema,
  input: Record<string, unknown>,
): ValidationResult {
  const errors: ValidationFailure[] = [];
  const values: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const raw = input[field.key];

    if (raw === undefined || raw === null || raw === '') {
      if (field.required) {
        errors.push({ field: field.key, reason: `${field.label} is required` });
      } else if (field.default !== undefined) {
        values[field.key] = field.default;
      }
      continue;
    }

    switch (field.type) {
      case 'boolean': {
        if (typeof raw === 'boolean') {
          values[field.key] = raw;
        } else if (raw === 'true' || raw === 'false') {
          values[field.key] = raw === 'true';
        } else {
          errors.push({ field: field.key, reason: `${field.label} must be true or false` });
        }
        break;
      }
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(n)) {
          errors.push({ field: field.key, reason: `${field.label} must be a number` });
        } else {
          values[field.key] = n;
        }
        break;
      }
      case 'select': {
        const allowed = (field.options || []).map((o) => o.value);
        if (allowed.length > 0 && !allowed.includes(String(raw))) {
          errors.push({
            field: field.key,
            reason: `${field.label} must be one of: ${allowed.join(', ')}`,
          });
        } else {
          values[field.key] = String(raw);
        }
        break;
      }
      case 'multiselect': {
        if (!Array.isArray(raw)) {
          errors.push({ field: field.key, reason: `${field.label} must be a list` });
          break;
        }
        const allowed = (field.options || []).map((o) => o.value);
        const bad = raw.filter((v) => allowed.length > 0 && !allowed.includes(String(v)));
        if (bad.length > 0) {
          errors.push({
            field: field.key,
            reason: `${field.label} contains invalid options: ${bad.join(', ')}`,
          });
        } else {
          values[field.key] = raw.map((v) => String(v));
        }
        break;
      }
      case 'date': {
        const d = raw instanceof Date ? raw : new Date(String(raw));
        if (Number.isNaN(d.getTime())) {
          errors.push({ field: field.key, reason: `${field.label} must be a valid date` });
        } else {
          values[field.key] = d.toISOString();
        }
        break;
      }
      case 'string':
      case 'textarea':
      default: {
        values[field.key] = String(raw).trim();
        break;
      }
    }
  }

  return { ok: errors.length === 0, errors, values };
}
