import { describe, it, expect } from 'vitest';
import { officeForPersonas, OFFICE_NAMES, OFFICE_PERSONA_CODES, COLLEGE_OFFICE, hodOffice } from '../offices';

describe('offices', () => {
  it('maps each staff office persona, and its sub-personas, to plain office words', () => {
    expect(officeForPersonas(['ST-EXAM'])).toBe('Exam Section');
    expect(officeForPersonas(['ST-ACC'])).toBe('Finance');
    expect(officeForPersonas(['ST-ADM-TC'])).toBe('Admissions');
    expect(officeForPersonas(['ST-TPO'])).toBe('Placement');
    expect(officeForPersonas(['ST-WARDEN'])).toBe('Welfare');
    expect(officeForPersonas(['ST-SEC'])).toBe('Campus Ops');
    expect(officeForPersonas(['ST-REG'])).toBe('Registrar');
  });

  it('returns null for personas that are not an office', () => {
    expect(officeForPersonas(['ST-HR'])).toBeNull();
    expect(officeForPersonas(['ST-ACOPS-CC'])).toBeNull();   // ST-ACC is not a prefix of ST-ACOPS
    expect(officeForPersonas([])).toBeNull();
  });

  it('lists the offices an admin may choose, college office first, without duplicates', () => {
    expect(OFFICE_NAMES[0]).toBe(COLLEGE_OFFICE);
    expect(new Set(OFFICE_NAMES).size).toBe(OFFICE_NAMES.length);
    expect(OFFICE_NAMES).toEqual(expect.arrayContaining(['Exam Section', 'Finance', 'Admissions', 'Placement', 'Welfare', 'Campus Ops', 'Registrar']));
    expect(OFFICE_PERSONA_CODES).toContain('ST-TRANSPORT-OFFICER');
    expect(hodOffice('Computer Science')).toBe('HOD, Computer Science');
  });
});
