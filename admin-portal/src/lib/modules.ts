/**
 * Canonical module slugs, matching the router mounts in
 * backend/src/routes/index.ts. Used wherever a form needs to offer "which
 * modules?" as a choice rather than free text.
 */
export const MODULE_OPTIONS = [
  { value: 'admissions', label: 'Admissions', hint: 'M01' },
  { value: 'people', label: 'People', hint: 'M02' },
  { value: 'academics', label: 'Academics', hint: 'M03' },
  { value: 'finance', label: 'Finance', hint: 'M04' },
  { value: 'hr', label: 'HR', hint: 'M05' },
  { value: 'welfare', label: 'Welfare', hint: 'M06' },
  { value: 'placement', label: 'Placement', hint: 'M07' },
  { value: 'campus', label: 'Campus Ops', hint: 'M08' },
  { value: 'student-dev', label: 'Student Development', hint: 'M09' },
  { value: 'compliance', label: 'Compliance', hint: 'M10' },
  { value: 'governance', label: 'Governance', hint: 'M11' },
  { value: 'platform', label: 'Platform', hint: 'M12' },
  { value: 'juvi', label: 'Juvi AI' },
] as const;

export const MODULE_VALUES: readonly string[] = MODULE_OPTIONS.map((m) => m.value);
