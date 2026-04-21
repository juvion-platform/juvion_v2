/**
 * PdfRenderer — thin, pure-presentation wrapper around pdfkit.
 *
 * This utility intentionally knows NOTHING about students, fees, invoices, or
 * any other business entity. It exposes a small set of layout primitives
 * (header, keyValueBlock, table, totals, footer) that callers compose into
 * a document. Business modules (commitment sheet, future transcripts,
 * receipts, certificates) build domain-specific PDFs by orchestrating calls
 * to these primitives.
 *
 * Design notes:
 * - `build()` buffers the document in memory via `Buffer.concat` over the
 *   `data` events. This is fine for our use case (commitment sheets ~ a few
 *   KB). For genuinely large PDFs, callers can use `pipeTo()` to stream
 *   directly to a Writable (e.g., an HTTP response or a blob-store upload).
 * - Each primitive returns `this` to allow fluent chaining.
 * - We defer drawing until `build()` / `pipeTo()` is called, so the same
 *   renderer instance can be re-used to stream twice (rare but cheap).
 *
 * See plan §1.8 and tasks.md Task 3.
 */
import PDFDocument from 'pdfkit';
import { Writable } from 'stream';

export interface PdfRendererOptions {
  pageSize?: 'A4' | 'Letter';
  /** Page margin in pt. Defaults to 50. */
  margin?: number;
  /**
   * Whether to FlateDecode-compress the PDF content streams. Defaults to
   * `true`. Callers (typically tests) can pass `false` to keep text content
   * as plain ASCII in the output buffer for easy assertion.
   */
  compress?: boolean;
}

export interface HeaderInput {
  /** Optional logo image bytes (PNG/JPEG). */
  logo?: Buffer;
  title: string;
  subtitle?: string;
}

export interface KeyValuePair {
  label: string;
  value: string;
}

export interface KeyValueBlockOptions {
  columns?: 2 | 3;
}

export interface TableInput {
  headers: string[];
  rows: Array<Array<string | number>>;
  title?: string;
}

export interface TotalsInput {
  label: string;
  amount: string;
  style?: 'net' | 'gross' | 'subtotal';
}

export interface FooterInput {
  left?: string;
  center?: string;
  right?: string;
}

/**
 * A deferred draw operation. We queue these up during the builder calls and
 * execute them sequentially against a fresh PDFDocument inside `build()` /
 * `pipeTo()`. This keeps the public API synchronous-looking while avoiding
 * double-rendering when `build()` is called multiple times.
 */
type DrawOp = (doc: InstanceType<typeof PDFDocument>) => void;

export class PdfRenderer {
  private readonly pageSize: 'A4' | 'Letter';
  private readonly margin: number;
  private readonly compress: boolean;
  private readonly ops: DrawOp[] = [];

  constructor(opts?: PdfRendererOptions) {
    this.pageSize = opts?.pageSize ?? 'A4';
    this.margin = opts?.margin ?? 50;
    this.compress = opts?.compress ?? true;
  }

  // ─────────────────────────────── primitives ───────────────────────────────

  header(input: HeaderInput): this {
    const { logo, title, subtitle } = input;
    this.ops.push((doc) => {
      if (logo) {
        // Place the logo in the top-left corner at a sensible height.
        try {
          doc.image(logo, doc.x, doc.y, { fit: [60, 60] });
          doc.moveDown(0.5);
        } catch {
          // Invalid image buffer — skip gracefully; header text still renders.
        }
      }
      doc.font('Helvetica-Bold').fontSize(18).text(title, { align: 'center' });
      if (subtitle) {
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(11).text(subtitle, { align: 'center' });
      }
      doc.moveDown(0.8);
      // Horizontal rule.
      const y = doc.y;
      doc
        .strokeColor('#CCCCCC')
        .lineWidth(0.5)
        .moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.width - doc.page.margins.right, y)
        .stroke();
      doc.strokeColor('black').lineWidth(1);
      doc.moveDown(0.5);
    });
    return this;
  }

  keyValueBlock(pairs: KeyValuePair[], opts?: KeyValueBlockOptions): this {
    const columns = opts?.columns ?? 2;
    this.ops.push((doc) => {
      const left = doc.page.margins.left;
      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colWidth = usableWidth / columns;
      const rowHeight = 18;

      let col = 0;
      let y = doc.y;
      doc.fontSize(10);

      for (const { label, value } of pairs) {
        const x = left + col * colWidth;
        doc.font('Helvetica-Bold').text(`${label}:`, x, y, {
          width: colWidth - 4,
          continued: false,
        });
        // pdfkit's text cursor advances after .text; we want the value on the
        // same logical line but offset. Simplest approach: render both on the
        // same y using absolute coords.
        const labelWidth = doc.widthOfString(`${label}:`) + 4;
        doc
          .font('Helvetica')
          .text(value, x + labelWidth, y, {
            width: colWidth - labelWidth - 4,
          });

        col += 1;
        if (col >= columns) {
          col = 0;
          y += rowHeight;
        }
      }
      if (col !== 0) {
        y += rowHeight;
      }
      doc.y = y;
      doc.x = left;
      doc.moveDown(0.5);
    });
    return this;
  }

  table(input: TableInput): this {
    const { headers, rows, title } = input;
    this.ops.push((doc) => {
      const left = doc.page.margins.left;
      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colCount = Math.max(1, headers.length);
      const colWidth = usableWidth / colCount;
      const rowHeight = 20;

      if (title) {
        doc.font('Helvetica-Bold').fontSize(12).text(title, left, doc.y);
        doc.moveDown(0.3);
      }

      // Header row.
      let y = doc.y;
      doc
        .rect(left, y - 2, usableWidth, rowHeight)
        .fillColor('#EEEEEE')
        .fill()
        .fillColor('black');
      doc.font('Helvetica-Bold').fontSize(10);
      headers.forEach((h, i) => {
        doc.text(h, left + i * colWidth + 4, y + 4, {
          width: colWidth - 8,
        });
      });
      y += rowHeight;

      // Body rows.
      doc.font('Helvetica').fontSize(10);
      for (const row of rows) {
        row.forEach((cell, i) => {
          doc.text(String(cell), left + i * colWidth + 4, y + 4, {
            width: colWidth - 8,
          });
        });
        // Thin divider.
        doc
          .strokeColor('#DDDDDD')
          .lineWidth(0.3)
          .moveTo(left, y + rowHeight)
          .lineTo(left + usableWidth, y + rowHeight)
          .stroke();
        doc.strokeColor('black').lineWidth(1);
        y += rowHeight;
      }
      doc.y = y;
      doc.x = left;
      doc.moveDown(0.5);
    });
    return this;
  }

  totals(input: TotalsInput): this {
    const { label, amount, style = 'subtotal' } = input;
    this.ops.push((doc) => {
      const left = doc.page.margins.left;
      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      const isBold = style === 'net' || style === 'gross';
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(style === 'net' ? 12 : 11);

      const y = doc.y;
      doc.text(label, left, y, { width: usableWidth / 2, align: 'right' });
      doc.text(amount, left + usableWidth / 2, y, {
        width: usableWidth / 2,
        align: 'right',
      });

      if (style === 'net') {
        // Heavy rule above a "net" total.
        doc
          .strokeColor('black')
          .lineWidth(1)
          .moveTo(left + usableWidth / 2, y - 2)
          .lineTo(left + usableWidth, y - 2)
          .stroke();
      }

      doc.moveDown(0.4);
    });
    return this;
  }

  footer(input: FooterInput): this {
    const { left, center, right } = input;
    this.ops.push((doc) => {
      // Render footer at the bottom of the current page.
      const marginLeft = doc.page.margins.left;
      const marginRight = doc.page.margins.right;
      const bottom = doc.page.height - doc.page.margins.bottom + 10;
      const usableWidth = doc.page.width - marginLeft - marginRight;
      const colWidth = usableWidth / 3;

      doc.font('Helvetica').fontSize(9).fillColor('#555555');

      if (left) {
        doc.text(left, marginLeft, bottom, { width: colWidth, align: 'left' });
      }
      if (center) {
        doc.text(center, marginLeft + colWidth, bottom, {
          width: colWidth,
          align: 'center',
        });
      }
      if (right) {
        doc.text(right, marginLeft + 2 * colWidth, bottom, {
          width: colWidth,
          align: 'right',
        });
      }
      doc.fillColor('black');
    });
    return this;
  }

  // ──────────────────────────────── output ────────────────────────────────

  /**
   * Build the PDF and resolve to a Buffer containing the full document.
   */
  async build(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = this.createDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        for (const op of this.ops) op(doc);
      } catch (err) {
        reject(err as Error);
        return;
      }
      doc.end();
    });
  }

  /**
   * Stream the PDF to the provided Writable. Resolves when the stream
   * finishes (i.e., the consumer has flushed all bytes).
   */
  async pipeTo(stream: NodeJS.WritableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = this.createDocument();

      // Forward errors from either end.
      doc.on('error', reject);
      if (stream instanceof Writable) {
        stream.on('error', reject);
      } else {
        // Older writable streams may not be `Writable` instances; best-effort.
        (stream as NodeJS.EventEmitter).on('error', reject);
      }
      (stream as NodeJS.EventEmitter).on('finish', () => resolve());

      doc.pipe(stream as NodeJS.WritableStream);

      try {
        for (const op of this.ops) op(doc);
      } catch (err) {
        reject(err as Error);
        return;
      }
      doc.end();
    });
  }

  // ──────────────────────────────── internals ────────────────────────────────

  private createDocument(): InstanceType<typeof PDFDocument> {
    return new PDFDocument({
      size: this.pageSize,
      margin: this.margin,
      compress: this.compress,
      info: {
        Producer: 'juvion-v2 PdfRenderer',
      },
    });
  }
}
