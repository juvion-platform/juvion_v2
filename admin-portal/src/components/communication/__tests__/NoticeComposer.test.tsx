import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import NoticeComposer from '../NoticeComposer';
import { renderWithProviders } from '../../../__tests__/test-utils';

vi.mock('../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../services/notices', () => ({
  getNoticeTargets: vi.fn(), previewAudience: vi.fn(), searchNoticePeople: vi.fn(), uploadNoticeAttachment: vi.fn(), publishNotice: vi.fn(),
}));
import { getNoticeTargets, previewAudience, uploadNoticeAttachment, publishNotice } from '../../../services/notices';
import { toast } from '../../../stores/toastStore';

const TARGETS = {
  office: 'College Office', offices: ['College Office', "Principal's Office", 'Exam Section'], isAdmin: true, timezone: 'Asia/Kolkata', canPublishUrgent: true,
  kinds: ['all', 'role', 'batch'], roles: ['student', 'faculty'],
  departments: [], programmes: [], batches: [{ id: 'b1', label: 'CSE 2024' }], sections: [], courseOfferings: [], hostelBlocks: [],
};
const PREVIEW = { total: 3, onJuvi: 2, notOnJuvi: 1, groups: [{ label: 'CSE 2024', total: 3, onJuvi: 2 }], line: 'Sent to CSE 2024' };
const pdf = (name = 'timetable.pdf', size = 1000) => { const f = new File(['x'], name, { type: 'application/pdf' }); Object.defineProperty(f, 'size', { value: size }); return f; };

function deferred<T>() {
  let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const onPublished = vi.fn();
const onClose = vi.fn();
function open(initial?: Parameters<typeof NoticeComposer>[0]['initial']) {
  return renderWithProviders(<NoticeComposer open onClose={onClose} onPublished={onPublished} initial={initial} />);
}
async function chooseBatch() {
  fireEvent.click(await screen.findByRole('button', { name: /^batches/i }));
  fireEvent.click(screen.getByRole('option', { name: 'CSE 2024' }));
  fireEvent.keyDown(screen.getByRole('combobox', { name: /search batches/i }), { key: 'Escape' });
  await screen.findByText(/2 on Juvi/);
}

beforeEach(() => {
  vi.clearAllMocks();
  (getNoticeTargets as Mock).mockResolvedValue(TARGETS);
  (previewAudience as Mock).mockResolvedValue(PREVIEW);
  (publishNotice as Mock).mockResolvedValue({ id: 'n1', audienceLine: 'Sent to CSE 2024' });
});

describe('NoticeComposer', () => {
  it('opens as a dialog with focus on the title, and lets an admin choose the office', async () => {
    open();
    expect(screen.getByRole('dialog', { name: 'New notice' })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    const office = await screen.findByLabelText('Publish as');
    expect(within(office).getAllByRole('option').map((o) => o.textContent)).toEqual(['College Office', "Principal's Office", 'Exam Section']);
  });

  it('shows a non-admin the office their persona gives', async () => {
    (getNoticeTargets as Mock).mockResolvedValue({ ...TARGETS, isAdmin: false, office: 'Exam Section', offices: ['Exam Section'] });
    open();
    expect(await screen.findByText(/Publishing as/)).toHaveTextContent('Publishing as Exam Section');
    expect(screen.queryByLabelText('Publish as')).toBeNull();
  });

  it('counts title and body characters against their limits', async () => {
    open();
    const title = screen.getByLabelText('Title');
    expect(title).toHaveAttribute('maxLength', '120');
    expect(screen.getByLabelText('Notice')).toHaveAttribute('maxLength', '5000');
    fireEvent.change(title, { target: { value: 'Exams' } });
    expect(screen.getByText('5/120')).toBeInTheDocument();
    expect(title).toHaveAccessibleDescription('5/120');
  });

  it('uploads attachments with per-file progress, refuses bad files, and removes one', async () => {
    const upload = deferred<unknown>();
    let report: (pct: number) => void = () => {};
    (uploadNoticeAttachment as Mock).mockImplementation((_f: File, onProgress: (p: number) => void) => { report = onProgress; return upload.promise; });
    open();
    const input = screen.getByLabelText('Add attachments');
    fireEvent.change(input, { target: { files: [pdf(), new File(['x'], 'notes.txt', { type: 'text/plain' }), pdf('huge.pdf', 10 * 1024 * 1024 + 1)] } });
    expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
    expect(screen.getByText('File too large (max 10 MB)')).toBeInTheDocument();
    act(() => report(40));
    expect(await screen.findByRole('progressbar', { name: 'Uploading timetable.pdf' })).toHaveAttribute('aria-valuenow', '40');
    upload.resolve({ key: 'colleges/c/notices/u1', name: 'timetable.pdf', mime: 'application/pdf', size: 1000 });
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(screen.getByText('1/5 · PDF, images, Word, Excel, PowerPoint · 10 MB each')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove notes.txt' }));
    expect(screen.queryByText(/Unsupported file type/)).toBeNull();
  });

  it('shows the server reason when storage is unavailable', async () => {
    (uploadNoticeAttachment as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 503, data: { error: 'Attachments are unavailable: file storage is not configured' } } });
    open();
    fireEvent.change(screen.getByLabelText('Add attachments'), { target: { files: [pdf()] } });
    expect(await screen.findByText('Attachments are unavailable: file storage is not configured')).toBeInTheDocument();
  });

  it('ties the deadline and comments to acknowledgement and notes what Urgent does', async () => {
    open();
    const deadline = screen.getByLabelText('Acknowledge by (Asia/Kolkata)');
    expect(deadline).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Require acknowledgement'));
    expect(deadline).toBeEnabled();
    expect(screen.getByLabelText('Allow a comment with the acknowledgement')).toBeEnabled();
    expect(screen.queryByText(/even during quiet hours/)).toBeNull();
    fireEvent.click(await screen.findByLabelText('Urgent'));
    expect(screen.getByText('Urgent notifies everyone at once, even during quiet hours and when they have muted the channel.')).toBeInTheDocument();
  });

  it('previews the notice as the Juvi card', async () => {
    open();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Mid-semester timetable' } });
    fireEvent.click(screen.getByLabelText('Require acknowledgement'));
    fireEvent.change(screen.getByLabelText('Acknowledge by (Asia/Kolkata)'), { target: { value: '2030-01-15T17:00' } });
    await chooseBatch();
    const card = screen.getByRole('region', { name: 'Preview in the Juvi app' });
    expect(within(card).getByText('Mid-semester timetable')).toBeInTheDocument();
    expect(within(card).getByText('College Office')).toBeInTheDocument();
    expect(within(card).getByText('Sent to CSE 2024')).toBeInTheDocument();
    expect(within(card).getByText(/Acknowledge by 15 Jan 2030/)).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: /time to the deadline left/ })).toBeInTheDocument();
  });

  it('refuses to review an incomplete notice', async () => {
    open();
    await screen.findByLabelText('Publish as');
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
    expect(screen.getByText('Give the notice a title')).toBeInTheDocument();
    expect(screen.getByText('Write the notice')).toBeInTheDocument();
    expect(screen.getByText('Choose who should receive this notice')).toBeInTheDocument();
    expect(publishNotice).not.toHaveBeenCalled();
  });

  it('confirms with the count, then publishes the exact payload with the deadline converted from college time', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Publish as'), { target: { value: 'Exam Section' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Mid-semester timetable ' } });
    fireEvent.change(screen.getByLabelText('Notice'), { target: { value: 'Attached.' } });
    fireEvent.click(screen.getByLabelText('Require acknowledgement'));
    fireEvent.change(screen.getByLabelText('Acknowledge by (Asia/Kolkata)'), { target: { value: '2030-01-15T17:00' } });
    fireEvent.click(screen.getByLabelText('Allow a comment with the acknowledgement'));
    fireEvent.click(screen.getByLabelText('Important'));
    await chooseBatch();
    await waitFor(() => expect(previewAudience).toHaveBeenLastCalledWith([{ kind: 'batch', ids: ['b1'] }], 'Exam Section'));
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));

    const heading = await screen.findByRole('heading', { name: 'Publish to 3 people?' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText('2 on Juvi see it on their next refresh.')).toBeInTheDocument();
    expect(screen.getByText('1 not on Juvi yet get it when they activate the app.')).toBeInTheDocument();
    expect(screen.getByText(/Acknowledge by 15 Jan 2030.*\(Asia\/Kolkata\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish notice' }));

    await waitFor(() => expect(publishNotice).toHaveBeenCalledWith({
      title: 'Mid-semester timetable', body: 'Attached.', attachments: [], audience: { rules: [{ kind: 'batch', ids: ['b1'] }] },
      ackRequired: true, ackDeadline: '2030-01-15T11:30:00.000Z', ackCommentAllowed: true,
      priority: 'important', purpose: 'standard', confidential: false, office: 'Exam Section',
    }));
    expect(toast.success).toHaveBeenCalledWith('Notice published', 'Delivering to 3 people.');
    expect(onPublished).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the draft on Back to edit, shows a publish failure in the confirm step, and does not bring it back', async () => {
    (publishNotice as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { error: 'Something went wrong on the server' } } });
    open({ purpose: 'welcome', title: 'Welcome to Juvi', ackRequired: true, audience: { role: [{ id: 'student', label: 'All students' }] } });
    fireEvent.change(screen.getByLabelText('Notice'), { target: { value: 'Hello.' } });
    await screen.findByText(/2 on Juvi/);
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish notice' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on the server');
    expect(publishNotice).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'welcome', title: 'Welcome to Juvi', audience: { rules: [{ kind: 'role', ids: ['student'] }] } }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Welcome to Juvi');
    expect(screen.getByLabelText('Notice')).toHaveValue('Hello.');
    expect(onClose).not.toHaveBeenCalled();
    // Focus lands on the button that opens the confirm step again.
    const reviewButton = screen.getByRole('button', { name: 'Review and publish' });
    await waitFor(() => expect(document.activeElement).toBe(reviewButton));
    // Reviewing again starts clean: the earlier failure is gone.
    fireEvent.click(reviewButton);
    expect(await screen.findByRole('button', { name: 'Publish notice' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('tells the publisher a welcome notice goes to new accounts at onboarding, not to existing users', async () => {
    open({ purpose: 'welcome', title: 'Welcome to Juvi', ackRequired: true, audience: { role: [{ id: 'student', label: 'All students' }] } });
    fireEvent.change(screen.getByLabelText('Notice'), { target: { value: 'Hello.' } });
    await screen.findByText(/2 on Juvi/);
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
    expect(await screen.findByRole('heading', { name: 'Publish this welcome notice?' })).toBeInTheDocument();
    expect(screen.getByText(/Each new account sees it at onboarding step 4/)).toBeInTheDocument();
    expect(screen.getByText(/People already using Juvi do not receive it/)).toBeInTheDocument();
    expect(screen.queryByText(/see it on their next refresh/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Publish notice' }));
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Welcome notice published', expect.stringMatching(/onboarding/));
  });

  it('offers no deadline on a welcome notice and never sends one, keeping acknowledgement and comments', async () => {
    open({ purpose: 'welcome', title: 'Welcome to Juvi', ackRequired: true, audience: { role: [{ id: 'student', label: 'All students' }] } });
    expect(screen.queryByLabelText('Acknowledge by (Asia/Kolkata)')).toBeNull();
    expect(screen.getByText(/No deadline: each person sees a welcome notice when they join\./)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Notice'), { target: { value: 'Hello.' } });
    fireEvent.click(screen.getByLabelText('Allow a comment with the acknowledgement'));
    await screen.findByText(/2 on Juvi/);
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish notice' }));
    await waitFor(() => expect(publishNotice).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'welcome', ackRequired: true, ackCommentAllowed: true, ackDeadline: null })));
  });

  it('shows an audience preview failure once, not again under the builder', async () => {
    (previewAudience as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 403, data: { error: 'You can only send notices to your own department.' } } });
    open();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Exams' } });
    fireEvent.change(screen.getByLabelText('Notice'), { target: { value: 'Soon.' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Everyone' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
    expect(screen.getAllByText(/You can only send notices to your own department\./)).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: /Publish to/ })).toBeNull();
  });

  describe('Urgent and Confidential (notifications spec §6.5, §9)', () => {
    async function fillNotice() {
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Exam hall changed' } });
      fireEvent.change(screen.getByLabelText('Notice'), { target: { value: 'Report to Hall B at 2 pm.' } });
      await chooseBatch();
    }

    it('offers Urgent only when /targets allows it, and says whom to ask otherwise', async () => {
      (getNoticeTargets as Mock).mockResolvedValue({ ...TARGETS, isAdmin: false, office: 'Registrar', offices: ['Registrar'], canPublishUrgent: false });
      open();
      expect(await screen.findByText('Need Urgent? Ask an IT admin.')).toBeInTheDocument();
      const priority = screen.getByRole('group', { name: 'Priority' });
      expect(within(priority).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['routine', 'important']);
      expect(screen.queryByLabelText('Urgent')).toBeNull();
    });

    it('does not offer the hint to someone who may publish Urgent', async () => {
      open();
      expect(await screen.findByLabelText('Urgent')).toBeInTheDocument();
      expect(screen.queryByText('Need Urgent? Ask an IT admin.')).toBeNull();
    });

    it('requires a 10–300 character reason with a counter, and sends it trimmed', async () => {
      open();
      await fillNotice();
      expect(screen.queryByLabelText('Reason for Urgent')).toBeNull();
      fireEvent.click(screen.getByLabelText('Urgent'));
      const reason = screen.getByLabelText('Reason for Urgent');
      expect(reason).toBeRequired();
      expect(reason).toHaveAttribute('maxLength', '300');
      fireEvent.change(reason, { target: { value: ' Too short ' } });
      expect(reason).toHaveAccessibleDescription('11/300 · at least 10 · kept in the audit trail');
      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
      expect(screen.getByText('Say why this is Urgent (at least 10 characters)')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Publish to/ })).toBeNull();

      fireEvent.change(reason, { target: { value: ' Exam moved to today ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
      await screen.findByRole('heading', { name: 'Publish to 3 people?' });
      expect(screen.getByText('Urgent: phones are notified at once, even during quiet hours. Reason: Exam moved to today')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Publish notice' }));
      await waitFor(() => expect(publishNotice).toHaveBeenCalledWith(expect.objectContaining({ priority: 'urgent', urgentReason: 'Exam moved to today' })));
    });

    it('drops the reason when the priority goes back to Important', async () => {
      open();
      await fillNotice();
      fireEvent.click(screen.getByLabelText('Urgent'));
      fireEvent.change(screen.getByLabelText('Reason for Urgent'), { target: { value: 'Exam moved to today' } });
      fireEvent.click(screen.getByLabelText('Important'));
      expect(screen.queryByLabelText('Reason for Urgent')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Publish notice' }));
      await waitFor(() => expect(publishNotice).toHaveBeenCalled());
      const input = (publishNotice as Mock).mock.calls[0]![0] as Record<string, unknown>;
      expect(input.priority).toBe('important');
      expect(input).not.toHaveProperty('urgentReason');
    });

    it('marks a notice Confidential, explains the notification with the office, and sends the flag', async () => {
      open();
      await fillNotice();
      const box = screen.getByLabelText('Confidential');
      expect(box).not.toBeChecked();
      expect(box).toHaveAccessibleDescription("The phone notification will say only 'New notice from College Office'. The content opens in the app.");
      fireEvent.change(screen.getByLabelText('Publish as'), { target: { value: 'Exam Section' } });
      expect(box).toHaveAccessibleDescription("The phone notification will say only 'New notice from Exam Section'. The content opens in the app.");
      fireEvent.click(box);
      await waitFor(() => expect(previewAudience).toHaveBeenLastCalledWith([{ kind: 'batch', ids: ['b1'] }], 'Exam Section'));
      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
      expect(await screen.findByText('Confidential: the phone notification says only "New notice from Exam Section".')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Publish notice' }));
      await waitFor(() => expect(publishNotice).toHaveBeenCalledWith(expect.objectContaining({ confidential: true, office: 'Exam Section' })));
    });

    it('explains a server refusal of Urgent and takes Urgent off the form', async () => {
      (publishNotice as Mock).mockRejectedValue({
        isAxiosError: true,
        response: { status: 403, data: { error: 'Only an IT admin can publish Urgent notices. Choose Routine or Important, or ask an IT admin.', detail: { code: 'URGENT_NOT_ALLOWED' } } },
      });
      open();
      await fillNotice();
      fireEvent.click(screen.getByLabelText('Urgent'));
      fireEvent.change(screen.getByLabelText('Reason for Urgent'), { target: { value: 'Exam moved to today' } });
      (getNoticeTargets as Mock).mockResolvedValue({ ...TARGETS, canPublishUrgent: false });
      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Publish notice' }));
      // The refusal closes the confirm step: Publish must not be reachable, so nothing goes out as a priority the user never reviewed.
      expect(await screen.findByRole('alert')).toHaveTextContent('Your account cannot publish Urgent notices. Go back and choose Routine or Important, or ask an IT admin.');
      expect(screen.queryByRole('heading', { name: /Publish to/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Publish notice' })).toBeNull();
      await waitFor(() => expect(getNoticeTargets).toHaveBeenCalledTimes(2));
      expect(await screen.findByText('Need Urgent? Ask an IT admin.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Urgent')).toBeNull();
      expect(screen.getByLabelText('Important')).toBeChecked();
      expect(publishNotice).toHaveBeenCalledTimes(1);
      // Going through review again is the only way to publish, and it shows Important.
      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
      expect(await screen.findByRole('heading', { name: 'Publish to 3 people?' })).toBeInTheDocument();
      expect(screen.queryByText(/^Urgent: phones/)).toBeNull();
      expect(screen.queryByLabelText('Reason for Urgent')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
