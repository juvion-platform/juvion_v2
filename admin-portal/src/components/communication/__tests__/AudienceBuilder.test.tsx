import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { useState } from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import AudienceBuilder, { selectionToRules, useAudiencePreview, type AudienceSelection } from '../AudienceBuilder';
import { renderWithProviders } from '../../../__tests__/test-utils';
import type { NoticeTargets } from '../../../services/notices';

vi.mock('../../../services/notices', () => ({ previewAudience: vi.fn(), searchNoticePeople: vi.fn() }));
import { previewAudience, searchNoticePeople } from '../../../services/notices';

const COLLEGE: NoticeTargets = {
  office: 'Exam Section', offices: ['Exam Section'], isAdmin: false, timezone: 'Asia/Kolkata', canPublishUrgent: false,
  kinds: ['all', 'role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom'],
  roles: ['student', 'faculty', 'staff', 'hod'],
  departments: [{ id: 'd1', label: 'Computer Science' }, { id: 'd2', label: 'Electronics' }],
  programmes: [{ id: 'p1', label: 'B.Tech' }],
  batches: [{ id: 'b1', label: 'CSE 2024' }, { id: 'b2', label: 'ECE 2024' }, { id: 'b3', label: 'CSE 2023' }],
  sections: [], courseOfferings: [], hostelBlocks: [],
};
const HOD: NoticeTargets = {
  ...COLLEGE, office: 'HOD, Computer Science', offices: ['HOD, Computer Science'],
  kinds: ['role', 'department', 'batch', 'section', 'course_offering', 'custom'], roles: ['student', 'faculty', 'staff'],
  departments: [{ id: 'd1', label: 'Computer Science' }], programmes: [], batches: [{ id: 'b3', label: 'CSE 2023' }],
};

function Harness({ targets }: { targets: NoticeTargets }) {
  const [sel, setSel] = useState<AudienceSelection>({});
  const preview = useAudiencePreview(selectionToRules(sel), undefined, 0);
  return <AudienceBuilder targets={targets} value={sel} onChange={setSel} preview={preview} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  (previewAudience as Mock).mockResolvedValue({ total: 3, onJuvi: 2, notOnJuvi: 1, groups: [{ label: 'CSE 2024 · Section A', total: 3, onJuvi: 2 }], line: 'Sent to CSE 2024' });
  (searchNoticePeople as Mock).mockResolvedValue({ items: [{ id: 'p9', label: 'Asha Rao', hint: 'CSE 2024 · Section A' }] });
});

describe('selectionToRules', () => {
  it('drops empty kinds, keeps Everyone, and orders kinds stably', () => {
    expect(selectionToRules({ batch: [{ id: 'b1', label: 'CSE 2024' }], all: [], role: [] })).toEqual([{ kind: 'all', ids: [] }, { kind: 'batch', ids: ['b1'] }]);
  });
});

describe('AudienceBuilder', () => {
  it('offers only the kinds the publisher may target', () => {
    renderWithProviders(<Harness targets={HOD} />);
    const group = screen.getByRole('group', { name: /choose who receives/i });
    expect(within(group).queryByRole('button', { name: 'Everyone' })).toBeNull();
    expect(within(group).queryByRole('button', { name: /programmes/i })).toBeNull();
    expect(within(group).getByRole('button', { name: /departments/i })).toBeInTheDocument();
  });

  it('opens a searchable listbox, toggles with the keyboard, and closes on Escape back to the chip', async () => {
    renderWithProviders(<Harness targets={COLLEGE} />);
    const chip = screen.getByRole('button', { name: /^batches/i });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    const search = screen.getByRole('combobox', { name: /search batches/i });
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: 'cse' } });
    const list = screen.getByRole('listbox', { name: 'Batches' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['CSE 2024', 'CSE 2023']);
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(within(list).getByRole('option', { name: 'CSE 2023' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(chip);
    const tags = screen.getByRole('list', { name: /selected audience/i });
    expect(within(tags).getByText('CSE 2023')).toBeInTheDocument();
    expect(screen.queryByText('b3')).toBeNull();   // never a raw id
  });

  it('shows the live count with the on-Juvi split and the per-group breakdown', async () => {
    renderWithProviders(<Harness targets={COLLEGE} />);
    fireEvent.click(screen.getByRole('button', { name: /^batches/i }));
    fireEvent.click(screen.getByRole('option', { name: 'CSE 2024' }));
    await waitFor(() => expect(previewAudience).toHaveBeenCalledWith([{ kind: 'batch', ids: ['b1'] }], undefined));
    expect(await screen.findByText(/2 on Juvi/)).toBeInTheDocument();
    expect(screen.getByText(/1 not on Juvi yet/)).toBeInTheDocument();
    expect(screen.getByText('Sent to CSE 2024')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /audience by batch/i });
    expect(within(table).getByText('CSE 2024 · Section A')).toBeInTheDocument();
    // Only the totals sentence is a live region; the breakdown is not re-announced.
    const live = screen.getByText(/2 on Juvi/).closest('[aria-live]')!;
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).not.toContainElement(table);
    expect(live).not.toHaveTextContent('Sent to CSE 2024');
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
  });

  it('searches people on the server and removes a tag', async () => {
    renderWithProviders(<Harness targets={COLLEGE} />);
    fireEvent.click(screen.getByRole('button', { name: /^people/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /search people/i }), { target: { value: 'asha' } });
    await waitFor(() => expect(searchNoticePeople).toHaveBeenLastCalledWith('asha'));
    fireEvent.click(await screen.findByRole('option', { name: /asha rao/i }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: /search people/i }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Asha Rao' }));
    expect(screen.queryByRole('list', { name: /selected audience/i })).toBeNull();
    expect(screen.getByText(/choose who should receive/i)).toBeInTheDocument();
  });

  it('says why a people search failed instead of claiming there are no matches', async () => {
    (searchNoticePeople as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 500, data: { error: 'People search is unavailable right now.' } } });
    renderWithProviders(<Harness targets={COLLEGE} />);
    fireEvent.click(screen.getByRole('button', { name: /^people/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('People search is unavailable right now.');
    expect(screen.queryByText(/no matches you can send to/i)).toBeNull();
  });

  it('closes the popup when focus leaves the picker, but not when it moves inside it', async () => {
    renderWithProviders(<><Harness targets={COLLEGE} /><button type="button">Outside</button></>);
    const chip = screen.getByRole('button', { name: /^batches/i });
    fireEvent.click(chip);
    const search = screen.getByRole('combobox', { name: /search batches/i });
    fireEvent.blur(search, { relatedTarget: chip });
    expect(screen.getByRole('listbox', { name: 'Batches' })).toBeInTheDocument();
    fireEvent.blur(search, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(chip).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the server scope refusal as an alert', async () => {
    (previewAudience as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 403, data: { error: 'You can only send notices to your own department.' } } });
    renderWithProviders(<Harness targets={COLLEGE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Outside your scope: You can only send notices to your own department.');
  });
});
