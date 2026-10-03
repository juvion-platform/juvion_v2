import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import Drawer from '../ui/Drawer';
import AudienceBuilder, { selectionToRules, useAudiencePreview, type AudienceSelection } from './AudienceBuilder';
import AttachmentsField, { type AttachmentsState } from './AttachmentsField';
import NoticeCardPreview from './NoticeCardPreview';
import NotificationTrayPreview from './NotificationTrayPreview';
import { toast } from '../../stores/toastStore';
import {
  getNoticeTargets, publishNotice, type AudiencePreview, type NoticeDetail, type NoticePriority, type NoticePurpose, type PublishNoticeInput,
} from '../../services/notices';
import {
  NEED_URGENT_HINT, NOTICE_BODY_MAX, NOTICE_TITLE_MAX, PRIORITY_LABELS, URGENT_NOTE, URGENT_REASON_MAX, URGENT_REASON_MIN,
  confidentialHelp, formatInZone, isUrgentNotAllowed, isoToZonedLocal, noticeErrorMessage, publishErrorMessage, zonedLocalToIso,
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
  const reasonId = useId();
  const confidentialId = useId();
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
  const [urgentReason, setUrgentReason] = useState('');
  const [confidential, setConfidential] = useState(false);
  const [step, setStep] = useState<'compose' | 'confirm'>('compose');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reviewRef = useRef<HTMLButtonElement>(null);
  const backFromConfirm = useRef(false);

  const purpose = initial?.purpose ?? 'standard';
  const officeChoice = targets?.isAdmin ? office || targets.office : undefined;
  const fromOffice = officeChoice ?? targets?.office ?? '';
  // Urgent is offered only to those /targets allows (notifications spec §6.5, §9). After a
  // URGENT_NOT_ALLOWED refusal /targets is fetched again, and a choice it no longer allows reads as Important.
  const canUrgent = targets?.canPublishUrgent === true;
  const priorities = canUrgent ? PRIORITIES : PRIORITIES.filter((p) => p !== 'urgent');
  const chosenPriority: NoticePriority = priority === 'urgent' && !canUrgent ? 'important' : priority;
  const urgent = chosenPriority === 'urgent';
  const rules = selectionToRules(audience);
  // Count only once /targets has said which office applies, so the first count is already the right one.
  const preview = useAudiencePreview(targets ? rules : [], officeChoice);
  // A welcome notice never has a deadline: each person sees it when they join (backend publishSchema).
  const deadlineIso = ackRequired && deadline && purpose !== 'welcome' ? zonedLocalToIso(deadline, tz) : null;
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
    // A refused Urgent closes the confirm step and falls back to Important, so the publisher
    // reviews the notice again before anything goes out; /targets is fetched again to take Urgent off the form.
    onError: (err) => {
      if (!isUrgentNotAllowed(err)) return;
      qc.invalidateQueries({ queryKey: ['notice-targets'] });
      setRefusal(publishErrorMessage(err));
      setPriority('important');
      backFromConfirm.current = true;
      setStep('compose');
    },
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
    if (urgent && urgentReason.trim().length < URGENT_REASON_MIN) e.urgentReason = `Say why this is Urgent (at least ${URGENT_REASON_MIN} characters)`;
    return e;
  }

  function review() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) { setRefusal(null); publish.reset(); setStep('confirm'); }
  }

  function submit() {
    publish.mutate({
      title: title.trim(), body: body.trim(), attachments: files.attachments, audience: { rules },
      ackRequired, ackDeadline: deadlineIso, ackCommentAllowed: ackRequired && ackCommentAllowed,
      priority: chosenPriority, purpose, confidential, ...(urgent ? { urgentReason: urgentReason.trim() } : {}),
      ...(officeChoice ? { office: officeChoice } : {}),
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
          urgentReason={urgent ? urgentReason.trim() : null} confidentialOffice={confidential ? fromOffice : null}
          pending={publish.isPending} error={publish.isError && !refusal ? publishErrorMessage(publish.error) : null}
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
              {welcome ? (
                <p className="text-xs text-gray-500">No deadline: each person sees a welcome notice when they join.</p>
              ) : (
                <div>
                  <label htmlFor={deadlineId} className={lbl}>Acknowledge by ({tz})</label>
                  <input id={deadlineId} type="datetime-local" className={inp} value={deadline} disabled={!ackRequired}
                    min={isoToZonedLocal(new Date().toISOString(), tz)} onChange={(e) => setDeadline(e.target.value)} />
                  <p className="mt-1 text-xs text-gray-500">Optional. Acknowledgements after it are still accepted and marked late.</p>
                  {err('deadline')}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ackCommentAllowed} disabled={!ackRequired} onChange={(e) => setAckCommentAllowed(e.target.checked)} />
                Allow a comment with the acknowledgement
              </label>
            </fieldset>

            {refusal && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{refusal}</p>}
            <fieldset>
              <legend className={lbl}>Priority</legend>
              <div className="flex gap-4">
                {priorities.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm">
                    <input type="radio" name="notice-priority" value={p} checked={chosenPriority === p} onChange={() => setPriority(p)} />
                    {PRIORITY_LABELS[p]}
                  </label>
                ))}
              </div>
              {targets && !canUrgent && <p className="mt-1 text-xs text-gray-500">{NEED_URGENT_HINT}</p>}
              {urgent && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-amber-700">{URGENT_NOTE}</p>
                  <div>
                    <label htmlFor={reasonId} className={lbl}>Reason for Urgent</label>
                    <textarea id={reasonId} className={inp} rows={2} required value={urgentReason} maxLength={URGENT_REASON_MAX}
                      aria-describedby={`${reasonId}-count`} onChange={(e) => setUrgentReason(e.target.value)} />
                    <p id={`${reasonId}-count`} className="mt-1 text-right text-xs text-gray-500">
                      {urgentReason.length}/{URGENT_REASON_MAX} · at least {URGENT_REASON_MIN} · kept in the audit trail
                    </p>
                    {err('urgentReason')}
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className={lbl}>Phone notification</legend>
              <label className="flex items-center gap-2 text-sm">
                <input id={confidentialId} type="checkbox" checked={confidential} aria-describedby={`${confidentialId}-help`}
                  onChange={(e) => setConfidential(e.target.checked)} />
                Confidential
              </label>
              <p id={`${confidentialId}-help`} className="mt-1 text-xs text-gray-500">{confidentialHelp(fromOffice)}</p>
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
              priority={chosenPriority} ackRequired={ackRequired} deadline={deadlineIso} timezone={tz} attachmentCount={files.attachments.length}
            />
            <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-gray-500">On the phone</p>
            <NotificationTrayPreview office={fromOffice} title={title} priority={chosenPriority} confidential={confidential} welcome={welcome} />
          </div>
        </div>
      </div>
    </>
  );
}

interface ConfirmProps {
  preview: AudiencePreview; office?: string; deadline: string | null; welcome: boolean;
  /** Set for an Urgent notice; `confidentialOffice` for a confidential one (notifications spec §6.5, §6.6). */
  urgentReason: string | null; confidentialOffice: string | null;
  pending: boolean; error: string | null; onBack: () => void; onPublish: () => void;
}

/**
 * Confirm-to-publish (spec §8): the count, the on-Juvi split, the deadline in college time. Takes focus.
 * A welcome notice is not sent to anyone now (spec §6.5), so it says who sees it instead of a count.
 */
function ConfirmStep({ preview: d, office, deadline, welcome, urgentReason, confidentialOffice, pending, error, onBack, onPublish }: ConfirmProps) {
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
            {urgentReason && <li>Urgent: phones are notified at once, even during quiet hours. Reason: {urgentReason}</li>}
            {confidentialOffice !== null && <li>Confidential: the phone notification says only "New notice from {confidentialOffice || 'your office'}".</li>}
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
