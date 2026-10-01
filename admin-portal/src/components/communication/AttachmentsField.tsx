import { useEffect, useId, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { uploadNoticeAttachment, type NoticeAttachment } from '../../services/notices';
import {
  NOTICE_ATTACHMENTS_MAX, NOTICE_ATTACHMENT_ACCEPT, NOTICE_ATTACHMENT_MAX_BYTES, NOTICE_ATTACHMENT_MIMES, formatBytes, noticeErrorMessage,
} from '../../lib/notices';

interface Slot { localId: string; name: string; size: number; progress: number; status: 'uploading' | 'done' | 'error'; error?: string; attachment?: NoticeAttachment }
export interface AttachmentsState { attachments: NoticeAttachment[]; uploading: boolean; failed: boolean }

let seq = 0;

/**
 * Notice attachments (spec §6.1): up to 5 files of 10 MB each, PDF, PNG, JPEG,
 * WEBP, DOCX, XLSX or PPTX. Each file uploads as soon as it is picked, with its
 * own progress bar; a refused or failed file stays listed with the reason until
 * removed. Uploads are plain calls, not mutations: each needs its own progress.
 */
export default function AttachmentsField({ onChange, disabled }: { onChange: (s: AttachmentsState) => void; disabled?: boolean }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChange({
      attachments: slots.flatMap((s) => (s.status === 'done' && s.attachment ? [s.attachment] : [])),
      uploading: slots.some((s) => s.status === 'uploading'),
      failed: slots.some((s) => s.status === 'error'),
    });
    // onChange is the parent's setter; only the slots drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const patch = (localId: string, p: Partial<Slot>) => setSlots((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...p } : s)));
  const kept = slots.filter((s) => s.status !== 'error').length;

  function onPick(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = '';   // the same file can be picked again after a remove
    let room = NOTICE_ATTACHMENTS_MAX - kept;
    const added: Slot[] = [];
    for (const file of files) {
      const localId = `a${++seq}`;
      const base = { localId, name: file.name, size: file.size, progress: 0 };
      let error: string | undefined;
      if (!NOTICE_ATTACHMENT_MIMES.includes(file.type)) error = 'Unsupported file type. Use PDF, PNG, JPEG, WEBP, DOCX, XLSX or PPTX.';
      else if (file.size > NOTICE_ATTACHMENT_MAX_BYTES) error = 'File too large (max 10 MB)';
      else if (room <= 0) error = `At most ${NOTICE_ATTACHMENTS_MAX} attachments`;
      if (error) { added.push({ ...base, status: 'error', error }); continue; }
      room -= 1;
      added.push({ ...base, status: 'uploading' });
      uploadNoticeAttachment(file, (pct) => patch(localId, { progress: pct }))
        .then((attachment) => patch(localId, { status: 'done', progress: 100, attachment }))
        .catch((err) => patch(localId, { status: 'error', error: noticeErrorMessage(err, 'Upload failed') }));
    }
    setSlots((prev) => [...prev, ...added]);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="block text-sm font-medium text-gray-700">Attachments</span>
        <span className="text-xs text-gray-500">{kept}/{NOTICE_ATTACHMENTS_MAX} · PDF, images, Word, Excel, PowerPoint · 10 MB each</span>
      </div>
      <label htmlFor={inputId}
        className={`mt-1 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${disabled || kept >= NOTICE_ATTACHMENTS_MAX ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
        <Paperclip size={14} aria-hidden="true" /> Add attachments
      </label>
      <input id={inputId} ref={inputRef} type="file" multiple accept={NOTICE_ATTACHMENT_ACCEPT} className="sr-only"
        disabled={disabled || kept >= NOTICE_ATTACHMENTS_MAX} onChange={(e) => onPick(e.target.files)} />
      {slots.length > 0 && (
        <ul className="mt-2 space-y-1.5" aria-label="Attachments">
          {slots.map((s) => (
            <li key={s.localId} className="rounded-lg border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{s.name} <span className="text-xs text-gray-500">{formatBytes(s.size)}</span></span>
                <button type="button" onClick={() => setSlots((prev) => prev.filter((x) => x.localId !== s.localId))} disabled={disabled}
                  aria-label={`Remove ${s.name}`} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={14} /></button>
              </div>
              {s.status === 'uploading' && (
                <div role="progressbar" aria-label={`Uploading ${s.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.progress}
                  className="mt-1.5 h-1.5 overflow-hidden rounded bg-gray-100">
                  <div className="h-full bg-primary-500 transition-all" style={{ width: `${s.progress}%` }} />
                </div>
              )}
              {s.status === 'error' && <p className="mt-1 text-xs text-red-600">{s.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
