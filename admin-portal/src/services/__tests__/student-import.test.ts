import { describe, it, expect } from 'vitest';
import { buildTemplateCsv, type ImportTemplate } from '../student-import';

const tpl: ImportTemplate = {
  entityType: 'student',
  label: 'Students',
  description: 'x',
  fields: [
    { fieldKey: 'name', label: 'Full Name *', type: 'string', required: true },
    { fieldKey: 'email', label: 'Email', type: 'string', required: false },
    { fieldKey: 'city', label: 'City', type: 'string', required: false },
  ],
  sampleRow: { name: 'Aarav Sharma', email: 'a@b.c', city: 'Hyderabad, TS' },
};

describe('buildTemplateCsv', () => {
  it('marks mandatory columns with a trailing asterisk', () => {
    const [header] = buildTemplateCsv(tpl).split('\n');
    expect(header).toBe('name*,email,city');
  });

  it('includes the sample row', () => {
    const [, sample] = buildTemplateCsv(tpl).split('\n');
    expect(sample).toBe('Aarav Sharma,a@b.c,"Hyderabad, TS"');
  });

  it('quotes values containing a comma, quote or newline', () => {
    const csv = buildTemplateCsv({
      ...tpl,
      fields: [{ fieldKey: 'a', label: 'A', type: 'string', required: false }],
      sampleRow: { a: 'has "quote"' },
    });
    expect(csv.split('\n')[1]).toBe('"has ""quote"""');
  });

  it('emits an empty cell for a field with no sample', () => {
    const csv = buildTemplateCsv({
      ...tpl,
      fields: [{ fieldKey: 'z', label: 'Z', type: 'string', required: false }],
      sampleRow: {},
    });
    expect(csv.split('\n')[1]).toBe('');
  });
});
