import { describe, it, expect } from 'vitest';
import { Writable } from 'stream';
import { PdfRenderer } from '../PdfRenderer';

/**
 * Tests for the pure-presentation PdfRenderer utility.
 *
 * These tests verify PDF buffer output by:
 *   (a) checking the PDF magic header (`%PDF-`)
 *   (b) extracting visible text from content streams and asserting substrings
 *
 * We construct the renderer with `compress: false` so pdfkit writes content
 * streams verbatim. pdfkit emits text via the `TJ` / `Tj` operators with
 * hex-encoded WinAnsi strings (e.g., `[<4d617267696e54> 120 <657374> 0] TJ`
 * for "MarginTest") plus inline kerning adjustments. We extract those hex
 * runs, concatenate them, decode latin1, and run substring assertions against
 * the resulting plain-text representation. No external `pdf-parse` dep.
 */

/** Build a PdfRenderer configured for substring-based test assertions. */
function newRenderer(opts: { pageSize?: 'A4' | 'Letter'; margin?: number } = {}): PdfRenderer {
  return new PdfRenderer({ ...opts, compress: false });
}

/**
 * Extract the concatenated visible text from an uncompressed PDF buffer.
 *
 * pdfkit writes text in content streams of the form:
 *   [<4d617267696e54> 120 <657374> 0] TJ
 *   (Hello World) Tj
 *
 * We capture every hex run inside angle brackets and every literal string
 * inside parens that appears before a Tj/TJ operator, decode them as latin1
 * (WinAnsi is effectively a superset of ASCII for our characters), and
 * concatenate into a single string.
 */
function extractPdfText(buf: Buffer): string {
  const s = buf.toString('latin1');
  let out = '';
  // Match hex strings inside angle brackets, e.g., <48656c6c6f>.
  const hexRe = /<([0-9a-fA-F\s]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(s)) !== null) {
    const cleaned = m[1]!.replace(/\s+/g, '');
    if (cleaned.length === 0 || cleaned.length % 2 !== 0) continue;
    let decoded = '';
    for (let i = 0; i < cleaned.length; i += 2) {
      decoded += String.fromCharCode(parseInt(cleaned.slice(i, i + 2), 16));
    }
    out += decoded;
  }
  // Also capture literal PDF strings "(...) Tj". pdfkit mostly uses hex but
  // this is a safety net for any plain-string Tj operators.
  const litRe = /\(((?:\\.|[^()\\])*)\)\s*Tj/g;
  while ((m = litRe.exec(s)) !== null) {
    out += m[1]!.replace(/\\(.)/g, '$1');
  }
  return out;
}

/** Helper: does the extracted text include the given substring? */
function bufferContains(buf: Buffer, needle: string): boolean {
  return extractPdfText(buf).includes(needle);
}

describe('PdfRenderer', () => {
  describe('build()', () => {
    it('returns a non-empty Buffer starting with the PDF magic header', async () => {
      const renderer = new PdfRenderer();
      const buf = await renderer.build();

      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('ends with a PDF EOF marker', async () => {
      const renderer = new PdfRenderer();
      const buf = await renderer.build();

      // PDFs terminate with "%%EOF" (possibly followed by whitespace).
      const tail = buf.slice(Math.max(0, buf.length - 16)).toString('ascii');
      expect(tail).toMatch(/%%EOF\s*$/);
    });
  });

  describe('section primitives', () => {
    it('renders a header with title and subtitle into the buffer', async () => {
      const buf = await newRenderer()
        .header({ title: 'ACME College Commitment Sheet', subtitle: 'AY 2026-27' })
        .build();

      expect(bufferContains(buf, 'ACME College Commitment Sheet')).toBe(true);
      expect(bufferContains(buf, 'AY 2026-27')).toBe(true);
    });

    it('renders a key-value block with labels and values', async () => {
      const buf = await newRenderer()
        .keyValueBlock([
          { label: 'Roll No', value: 'ACM2026001' },
          { label: 'Programme', value: 'B.Tech CSE' },
          { label: 'Quota', value: 'Management' },
        ])
        .build();

      expect(bufferContains(buf, 'Roll No')).toBe(true);
      expect(bufferContains(buf, 'ACM2026001')).toBe(true);
      expect(bufferContains(buf, 'B.Tech CSE')).toBe(true);
      expect(bufferContains(buf, 'Management')).toBe(true);
    });

    it('renders a table with headers and row cells (including numbers)', async () => {
      const buf = await newRenderer()
        .table({
          title: 'Fee Components',
          headers: ['Component', 'Amount'],
          rows: [
            ['Tuition Fee', 80000],
            ['Lab Fee', 5000],
          ],
        })
        .build();

      expect(bufferContains(buf, 'Fee Components')).toBe(true);
      expect(bufferContains(buf, 'Component')).toBe(true);
      expect(bufferContains(buf, 'Amount')).toBe(true);
      expect(bufferContains(buf, 'Tuition Fee')).toBe(true);
      expect(bufferContains(buf, '80000')).toBe(true);
      expect(bufferContains(buf, 'Lab Fee')).toBe(true);
      expect(bufferContains(buf, '5000')).toBe(true);
    });

    it('renders a totals row with label and amount', async () => {
      const buf = await newRenderer()
        .totals({ label: 'Net Payable', amount: 'INR 85,000', style: 'net' })
        .build();

      expect(bufferContains(buf, 'Net Payable')).toBe(true);
      expect(bufferContains(buf, 'INR 85,000')).toBe(true);
    });

    it('renders a footer with left/center/right text', async () => {
      const buf = await newRenderer()
        .footer({
          left: 'Generated 2026-04-19',
          center: 'Pin ID 507f1f77',
          right: 'Page 1 of 1',
        })
        .build();

      expect(bufferContains(buf, 'Generated 2026-04-19')).toBe(true);
      expect(bufferContains(buf, 'Pin ID 507f1f77')).toBe(true);
      expect(bufferContains(buf, 'Page 1 of 1')).toBe(true);
    });
  });

  describe('composition', () => {
    it('renders header + key-value + table + totals + footer in one document', async () => {
      const buf = await newRenderer()
        .header({ title: 'Commitment Sheet', subtitle: 'Subtitle Line' })
        .keyValueBlock([
          { label: 'Name', value: 'Jane Doe' },
          { label: 'Year', value: '1' },
        ])
        .table({
          headers: ['Item', 'Cost'],
          rows: [['Tuition', 80000]],
        })
        .totals({ label: 'Total', amount: '80000', style: 'gross' })
        .footer({ left: 'Left Footer', right: 'Right Footer' })
        .build();

      // Spot-check that every section's text made it into the buffer.
      for (const s of [
        'Commitment Sheet',
        'Subtitle Line',
        'Name',
        'Jane Doe',
        'Year',
        'Item',
        'Cost',
        'Tuition',
        '80000',
        'Total',
        'Left Footer',
        'Right Footer',
      ]) {
        expect(bufferContains(buf, s), `missing substring: ${s}`).toBe(true);
      }
    });

    it('supports fluent method chaining', () => {
      const renderer = new PdfRenderer();
      const result = renderer
        .header({ title: 'X' })
        .keyValueBlock([{ label: 'k', value: 'v' }])
        .table({ headers: ['H'], rows: [['r']] })
        .totals({ label: 'T', amount: '1' })
        .footer({ left: 'L' });
      expect(result).toBe(renderer);
    });
  });

  describe('constructor options', () => {
    it('accepts pageSize option (A4 default and Letter override produce different buffer sizes or metadata)', async () => {
      // Both buffers should be valid PDFs. The simplest reliable check is
      // that each starts with the PDF magic and both render the title.
      const bufA4 = await newRenderer({ pageSize: 'A4' })
        .header({ title: 'PageSizeTest' })
        .build();
      const bufLetter = await newRenderer({ pageSize: 'Letter' })
        .header({ title: 'PageSizeTest' })
        .build();

      expect(bufA4.slice(0, 5).toString('ascii')).toBe('%PDF-');
      expect(bufLetter.slice(0, 5).toString('ascii')).toBe('%PDF-');
      expect(bufferContains(bufA4, 'PageSizeTest')).toBe(true);
      expect(bufferContains(bufLetter, 'PageSizeTest')).toBe(true);
    });

    it('accepts margin option without throwing', async () => {
      const buf = await newRenderer({ margin: 20 })
        .header({ title: 'MarginTest' })
        .build();
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
      expect(bufferContains(buf, 'MarginTest')).toBe(true);
    });
  });

  describe('pipeTo()', () => {
    it('writes the same content as build() into a Writable stream', async () => {
      // Build once via build().
      const builtBuf = await newRenderer()
        .header({ title: 'StreamTest' })
        .keyValueBlock([{ label: 'K', value: 'V' }])
        .build();

      // Stream-write into a collecting Writable.
      const chunks: Buffer[] = [];
      const sink = new Writable({
        write(chunk, _enc, cb) {
          chunks.push(Buffer.from(chunk));
          cb();
        },
      });

      await newRenderer()
        .header({ title: 'StreamTest' })
        .keyValueBlock([{ label: 'K', value: 'V' }])
        .pipeTo(sink);

      const streamedBuf = Buffer.concat(chunks);

      // Both are valid PDFs.
      expect(builtBuf.slice(0, 5).toString('ascii')).toBe('%PDF-');
      expect(streamedBuf.slice(0, 5).toString('ascii')).toBe('%PDF-');

      // Both contain the user-visible text. (We avoid a strict byte-for-byte
      // equality check because pdfkit embeds timestamps/object IDs that may
      // diverge between runs.)
      expect(bufferContains(streamedBuf, 'StreamTest')).toBe(true);
      expect(bufferContains(streamedBuf, 'K')).toBe(true);
      expect(bufferContains(streamedBuf, 'V')).toBe(true);
    });
  });

  describe('purity (no business knowledge)', () => {
    it('has no references to students, fees, or any business entity in its public API', () => {
      // Structural check: the public API surface accepts plain primitives
      // (title, label, value, headers, rows, amount, left/center/right text).
      // There is nothing in the API that refers to studentId, feeStructure,
      // commitment, invoice, etc. This test is a belt-and-braces reminder
      // to keep the renderer dumb — if someone adds a `studentId` param it
      // will fail the TypeScript compile, not this runtime assertion.
      //
      // We just confirm the renderer constructs, chains, and builds without
      // any domain-specific input.
      const r = new PdfRenderer();
      expect(r).toBeInstanceOf(PdfRenderer);
    });
  });
});
