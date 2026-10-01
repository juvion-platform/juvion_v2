import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import Drawer from '../ui/Drawer';
import AudienceBuilder, { selectionToRules, useAudiencePreview, type AudienceSelection } from './AudienceBuilder';
import AttachmentsField, { type AttachmentsState } from './AttachmentsField';
import NoticeCardPreview from './NoticeCardPreview';
import { toast } from '../../stores/toastStore';
import {
  getNoticeTargets, publishNotice, type AudiencePreview, type NoticeDetail, type NoticePriority, type NoticePurpose, type PublishNoticeInput,
} from '../../services/notices';
import {
  NOTICE_BODY_MAX, NOTICE_TITLE_MAX, PRIORITY_LABELS, URGENT_NOTE, formatInZone, isoToZonedLocal, noticeErrorMessage, zonedLocalToIso,
} from '../../lib/notices';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';
const PRIORITIES: NoticePriority[] = ['routine', 'important', 'urgent'];
const n = (x: number) => x.toLocaleString('en-IN');

/** Prefill for an embedding page (the Welcome notice setting passes purpose, title and audience). */
export interface ComposerInitial {
  title?: string;
  body?: string;
  purpose?: NoticePurpose;
  ackRequired?: boolean;
  audience?: AudienceSelection;
}

interface FormProps {
  initial?: ComposerInitial;
  onPublished: (notice: NoticeDetail) => void;
  onCancel: () => void;
  /** Attached to the title input, so a drawer can focus it on open. */
  titleRef?: RefObject<HTMLInputElement | null>;
}

/**
 * The notice composer (spec §8), embeddable on any page. Publishing is two
 * steps: "Review and publish" validates and shows the count; only "Publish
 * notice" posts. The form stays mounted (hidden) during the confirm step, so
 * uploads and picker state survive "Back to edit".
 */
export function NoticeComposerForm({ initial, onPublished, onCancel, titleRef }: FormProps) {
  const qc = useQueryClient();
  const titleId = useId();
  const bodyId = useId();
  const officeId = useId();
  const deadlineId = useId();
  const targetsQ = useQuery({ queryKey: ['notice-targets'], queryFn: getNoticeTargets, staleTime: 5 * 60_000, meta: { silentError: true } });
  const targets = targetsQ.data;
  const tz = targets?.timezone ?? 'Asia/Kolkata';

  const [office, setOffice] = useState('');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [audience, setAudience] = useState<AudienceSelection>(initial?.audience ?? {});
  const [files, setFiles] = useState<AttachmentsState>({ attachments: [], uploading: false, failed: false });
  const [ackRequired, setAckRequired] = useState(initial?.ackRequired ?? false);
  const [deadline, setDeadline] = useState('');   // datetime-local, in college time
  const [ackCommentAllowed, setAckCommentAllowed] = useState(false);
  const [priority, setPriority] = useState<NoticePriority>('routine');
  const [step, setStep] = useState<'compose' | 'confirm'>('compose');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reviewRef = useRef<HTMLButtonElement>(null);
  const backFromConfirm = useRef(false);

  const purpose = initial?.purpose ?? 'standard';
  const officeChoice = targets?.isAdmin ? office || targets.office : undefined;
  const rules = selectionToRules(audience);
  // Count only once /targets has said which office applies, so the first count is already the right one.
  const preview = useAudiencePreview(targets ? rules : [], officeChoice);
  const deadlineIso = ackRequired && deadline ? zonedLocalToIso(deadline, tz) : null;
  const confirming = step === 'confirm' ? preview.data : undefined;
  const welcome = purpose === 'welcome';

  // Back to edit returns focus to the button that opened the confirm step.
  useEffect(() => {
    if (step === 'compose' && backFromConfirm.current) { backFromConfirm.current = false; reviewRef.current?.focus(); }
  }, [step]);

  const publish = useMutation({
    mutationFn: (input: PublishNoticeInput) => publishNotice(input),
    // The confirm step renders a failure itself; the success toast is below.
    meta: { silent: true, silentError: true },
    onSuccess: (notice) => {
      qc.invalidateQueries({ queryKey: ['notices'] });
      const total = preview.data?.total ?? 0;
      if (welcome) toast.success('Welcome notice published', 'New accounts see it at onboarding once it is saved as the welcome notice.');
      else toast.success('Notice published', `Delivering to ${n(total)} ${total === 1 ? 'person' : 'people'}.`);
      onPublished(notice);
    },
  });

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Give the notice a title';
    if (!body.trim()) e.body = 'Write the notice';
    if (rules.length === 0) e.audience = 'Choose who should receive this notice';
    else if (preview.isError) e.audience = noticeErrorMessage(preview.error);
    else if (!preview.current) e.audience = 'Wait for the audience count to finish';
    // A welcome notice reaches accounts as they onboard, so an audience with no members yet is fine.
    else if (preview.data?.total === 0 && !welcome) e.audience = 'This audience has no members';
    if (files.uploading) e.attachments = 'Wait for the uploads to finish';
    else if (files.failed) e.attachments = 'Remove the attachments that could not be uploaded';
    if (deadlineIso && new Date(deadlineIso).getTime() <= Date.now()) e.deadline = 'The deadline must be in the future';
    return e;
  }

  function review() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) setStep('confirm');
  }

  function submit() {
    publish.mutate({
      title: title.trim(), body: body.trim(), attachments: files.attachments, audience: { rules },
      ackRequired, ackDeadline: deadlineIso, ackCommentAllowed: ackRequired && ackCommentAllowed,
      priority, purpose, ...(officeChoice ? { office: officeChoice } : {}),
    });
  }

  function backToEdit() {
    publish.reset();   // a failure from this attempt must not reappear on the next review
    backFromConfirm.current = true;
    setStep('compose');
  }

  function toggleAck(on: boolean) {
    setAckRequired(on);
    if (!on) { setDeadline(''); setAckCommentAllowed(false); }
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>;

  return (
    <>
      {confirming && (
        <ConfirmStep
          preview={confirming} office={officeChoice} deadline={deadlineIso && `${formatInZone(deadlineIso, tz)} (${tz})`} welcome={welcome}
          pending={publish.isPending} error={publish.isError ? noticeErrorMessage(publish.error) : null}
          onBack={backToEdit} onPublish={submit}
        />
      )}
      <div hidden={Boolean(confirming)}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-5">
            {targetsQ.isError && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{noticeErrorMessage(targetsQ.error)}</p>
            )}
            {targets?.isAdmin ? (
              <div>
                <label htmlFor={officeId} className={lbl}>Publish as</label>
                <select id={officeId} className={inp} value={officeChoice} onChange={(e) => setOffice(e.target.value)}>
                  {targets.offices.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ) : targets && (
              <p className="text-sm text-gray-600">Publishing as <span className="font-medium text-gray-900">{targets.office}</span></p>
            )}

            <div>
              <label htmlFor={titleId} className={lbl}>Title</label>
              <input id={titleId} ref={titleRef} className={inp} value={title} maxLength={NOTICE_TITLE_MAX} aria-describedby={`${titleId}-count`}
                onChange={(e) => setTitle(e.target.value)} />
              <p id={`${titleId}-count`} className="mt-1 text-right text-xs text-gray-500">{title.length}/{NOTICE_TITLE_MAX}</p>
              {err('title')}
            </div>

            <div>
              <label htmlFor={bodyId} className={lbl}>Notice</label>
              <textarea id={bodyId} className={inp} rows={7} value={body} maxLength={NOTICE_BODY_MAX} aria-describedby={`${bodyId}-count`}
                onChange={(e) => setBody(e.target.value)} />
              <p id={`${bodyId}-count`} className="mt-1 text-right text-xs text-gray-500">{body.length}/{NOTICE_BODY_MAX} · plain text; links are detected in the app</p>
              {err('body')}
            </div>

            <div>
              <AttachmentsField onChange={setFiles} />
              {err('attachments')}
            </div>

            {targets ? (
              <div>
                <AudienceBuilder targets={targets} value={audience} onChange={setAudience} preview={preview} />
                {/* AudienceCount already shows a preview failure. */}
                {!preview.isError && err('audience')}
              </div>
            ) : !targetsQ.isError && <p className="text-sm text-gray-500">Loading who you can send to…</p>}

            <fieldset className="space-y-2">
              <legend className={lbl}>Acknowledgement</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ackRequired} onChange={(e) => toggleAck(e.target.checked)} />
                Require acknowledgement
              </label>
              <div>
                <label htmlFor={deadlineId} className={lbl}>Acknowledge by ({tz})</label>
                <input id={deadlineId} type="datetime-local" className={inp} value={deadline} disabled={!ackRequired}
                  min={isoToZonedLocal(new Date().toISOString(), tz)} onChange={(e) => setDeadline(e.target.value)} />
                <p className="mt-1 text-xs text-gray-500">Optional. Acknowledgements after it are still accepted and marked late.</p>
                {err('deadline')}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ackCommentAllowed} disabled={!ackRequired} onChange={(e) => setAckCommentAllowed(e.target.checked)} />
                Allow a comment with the acknowledgement
              </label>
            </fieldset>

            <fieldset>
              <legend className={lbl}>Priority</legend>
              <div className="flex gap-4">
                {PRIORITIES.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm">
                    <input type="radio" name="notice-priority" value={p} checked={priority === p} onChange={() => setPriority(p)} />
                    {PRIORITY_LABELS[p]}
                  </label>
                ))}
              </div>
              {priority === 'urgent' && <p className="mt-1 text-xs text-amber-700">{URGENT_NOTE}</p>}
            </fieldset>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button ref={reviewRef} type="button" onClick={review} disabled={!targets}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
                Review and publish
              </button>
            </div>
          </div>

          <div className="lg:sticky lg:top-0 lg:self-start">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Preview</p>
            <NoticeCardPreview
              title={title} body={body} office={officeChoice ?? targets?.office ?? ''} audienceLine={rules.length ? preview.data?.line ?? '' : ''}
              priority={priority} ackRequired={ackRequired} deadline={deadlineIso} timezone={tz} attachmentCount={files.attachments.length}
            />
          </div>
        </div>
      </div>
    </>
  );
}

interface ConfirmProps {
  preview: AudiencePreview; office?: string; deadline: string | null; welcome: boolean;
  pending: boolean; error: string | null; onBack: () => void; onPublish: () => void;
}

/**
 * Confirm-to-publish (spec §8): the count, the on-Juvi split, the deadline in college time. Takes focus.
 * A welcome notice is not sent to anyone now (spec §6.5), so it says who sees it instead of a count.
 */
function ConfirmStep({ preview: d, office, deadline, welcome, pending, error, onBack, onPublish }: ConfirmProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <div className="space-y-4">
      <h4 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-navy focus:outline-none">
        {welcome ? 'Publish this welcome notice?' : `Publish to ${n(d.total)} ${d.total === 1 ? 'person' : 'people'}?`}
      </h4>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
        {welcome ? (
          <>
            <li>Each new account sees it at onboarding step 4, once it is saved as the welcome notice.</li>
            <li>People already using Juvi do not receive it. To reach them, publish a regular notice.</li>
            {office && <li>From {office}.</li>}
          </>
        ) : (
          <>
            <li>{d.line}{office ? `, from ${office}` : ''}.</li>
            <li>{n(d.onJuvi)} on Juvi see it on their next refresh.</li>
            {d.notOnJuvi > 0 && <li>{n(d.notOnJuvi)} not on Juvi yet get it when they activate the app.</li>}
          </>
        )}
        {deadline && <li>Acknowledge by {deadline}.</li>}
        <li>A published notice cannot be edited. You can archive it.</li>
      </ul>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onBack} disabled={pending} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Back to edit</button>
        <button type="button" onClick={onPublish} disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
          <Send size={15} /> {pending ? 'Publishing…' : 'Publish notice'}
        </button>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: ComposerInitial;
  onPublished?: (notice: NoticeDetail) => void;
  title?: string;
}

/** `<NoticeComposer />`: the composer in a drawer. It unmounts on close, so every opening starts fresh. */
export default function NoticeComposer({ open, onClose, initial, onPublished, title = 'New notice' }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  return (
    <Drawer open={open} onClose={onClose} title={title} description="Sent to the Juvi app. A published notice cannot be edited." widthClass="max-w-4xl" initialFocus={titleRef}>
      <NoticeComposerForm initial={initial} titleRef={titleRef} onCancel={onClose} onPublished={(notice) => { onPublished?.(notice); onClose(); }} />
    </Drawer>
  );
}
