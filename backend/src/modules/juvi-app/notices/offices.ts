/**
 * The "office" a notice is published from, in plain words (spec §5 `publisher.office`).
 * Staff office personas map to fixed words; admins pick one of OFFICE_NAMES.
 */
export const COLLEGE_OFFICE = 'College Office';
export const PRINCIPAL_OFFICE = "Principal's Office";
export const FACULTY_OFFICE = 'Course Faculty';

/** Persona code → office. A code also covers its sub-personas (ST-ADM covers ST-ADM-TC). */
export const OFFICE_PERSONAS: Readonly<Record<string, string>> = {
  'ST-EXAM': 'Exam Section',
  'ST-ACC': 'Finance',
  'ST-ADM': 'Admissions',
  'ST-TPO': 'Placement',
  'ST-WARDEN': 'Welfare',
  'ST-TRANSPORT-OFFICER': 'Campus Ops',
  'ST-SEC': 'Campus Ops',
  'ST-LIB': 'Campus Ops',
  'ST-REG': 'Registrar',
};

export const OFFICE_PERSONA_CODES: readonly string[] = Object.keys(OFFICE_PERSONAS);

export const OFFICE_NAMES: readonly string[] = [COLLEGE_OFFICE, PRINCIPAL_OFFICE, ...new Set(Object.values(OFFICE_PERSONAS))];

const inFamily = (code: string, family: string) => code === family || code.startsWith(`${family}-`);

/** The office for the first persona that is a staff office, or null. */
export function officeForPersonas(codes: string[]): string | null {
  for (const code of codes) {
    for (const family of OFFICE_PERSONA_CODES) if (inFamily(code, family)) return OFFICE_PERSONAS[family]!;
  }
  return null;
}

export function hodOffice(departmentName: string): string {
  return `HOD, ${departmentName}`;
}
