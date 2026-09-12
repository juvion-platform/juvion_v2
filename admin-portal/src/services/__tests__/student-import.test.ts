import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mocked before importing the module under test — see colleges.test.ts for
// the same pattern used elsewhere in this workspace.
vi.mock('../api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '../api';
import {
  buildTemplateCsv,
  getStudentImportTemplate,
  previewStudentImport,
  commitStudentImport,
  type ImportTemplate,
  type ImportPreview,
} from '../student-import';

const mockedGet = (api as unknown as { get: Mock }).get;
const mockedPost = (api as unknown as { post: Mock }).post;

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
});

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

  it('quotes a value containing a newline', () => {
    // NOTE: the sample cell itself contains a raw newline once quoted, so
    // `.split('\n')` (used by the other cases above) would wrongly cut the
    // quoted cell in two. Assert the full string instead.
    const csv = buildTemplateCsv({
      ...tpl,
      fields: [{ fieldKey: 'notes', label: 'Notes', type: 'string', required: false }],
      sampleRow: { notes: 'line1\nline2' },
    });
    expect(csv).toBe('notes\n"line1\nline2"');
  });

  it('emits an empty cell for a field with no sample', () => {
    const csv = buildTemplateCsv({
      ...tpl,
      fields: [{ fieldKey: 'z', label: 'Z', type: 'string', required: false }],
      sampleRow: {},
    });
    expect(csv.split('\n')[1]).toBe('');
  });

  it('derives every header cell from fieldKey, never from label', () => {
    // Labels are deliberately unrelated to their fieldKeys (operator-facing
    // free text, e.g. "as per Aadhaar" hints) so a header built from label
    // instead of fieldKey would fail this in an obvious way, not a subtle
    // one. This backs the same contract normalizeImportHeader
    // (backend/src/modules/platform/bulk-import-service.ts) round-trips.
    const mixed: ImportTemplate = {
      entityType: 'student',
      label: 'Students',
      description: 'x',
      fields: [
        { fieldKey: 'name', label: 'Full Legal Name (as per Aadhaar)', type: 'string', required: true },
        { fieldKey: 'phone', label: 'Mobile Number', type: 'string', required: true },
        { fieldKey: 'email', label: 'Email Address', type: 'string', required: false },
        { fieldKey: 'city', label: 'City / Town', type: 'string', required: false },
      ],
      sampleRow: {},
    };
    const [header] = buildTemplateCsv(mixed).split('\n');
    const cells = header!.split(',');
    mixed.fields.forEach((f, i) => {
      expect(cells[i]).toBe(f.required ? `${f.fieldKey}*` : f.fieldKey);
    });
  });
});

describe('getStudentImportTemplate', () => {
  it('GETs /people/students/import/template and unwraps response.data', async () => {
    mockedGet.mockResolvedValue({ data: tpl });

    const out = await getStudentImportTemplate();

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith('/people/students/import/template');
    expect(out).toEqual(tpl);
  });
});

describe('previewStudentImport', () => {
  it('POSTs the file as FormData under "file" with a multipart Content-Type override', async () => {
    const preview: ImportPreview = {
      job: { _id: 'job-1' },
      headers: ['name', 'email'],
      previewRows: [],
      validCount: 0,
      errorCount: 0,
      actionCounts: { create: 0, update: 0, blocked: 0 },
      sideEffectTotals: {},
      eligibleRowNumbers: [],
    };
    mockedPost.mockResolvedValue({ data: preview });
    const file = new File(['name,email\nAarav,a@b.c'], 'students.csv', { type: 'text/csv' });

    const out = await previewStudentImport(file);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedPost.mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
    expect(url).toBe('/people/students/import/preview');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBe(file);
    // This is the assertion that stops someone from "cleaning up" the
    // override as dead code — removing it silently breaks every upload
    // (see the comment on previewStudentImport for why).
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(out).toEqual(preview);
  });
});

describe('commitStudentImport', () => {
  it('POSTs { jobId } to /people/students/import/commit and unwraps response.data', async () => {
    mockedPost.mockResolvedValue({ data: { successCount: 3, failureCount: 1 } });

    const out = await commitStudentImport('job-123');

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith('/people/students/import/commit', { jobId: 'job-123' });
    expect(out).toEqual({ successCount: 3, failureCount: 1 });
  });
});
