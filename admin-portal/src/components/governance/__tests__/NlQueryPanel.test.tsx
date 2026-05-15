import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import NlQueryPanel from '../NlQueryPanel';
import type { NlQueryResponse } from '../../../services/governance';

/**
 * 003-nl-report-queries Task 5.1 — NL query panel.
 *
 *   - renders the textarea + Ask button
 *   - submit fires runNlQuery with the typed question
 *   - matched response shows "Auto-selected:" banner + rationale + Run-as-picker button
 *   - refused response shows reason + chip list of supported reports
 *   - "Run as picker" callback fires with the matched reportCode + params
 */

const { runNlQueryMock } = vi.hoisted(() => ({ runNlQueryMock: vi.fn() }));

vi.mock('../../../services/governance', async (orig) => {
  const actual = await orig<typeof import('../../../services/governance')>();
  return { ...actual, runNlQuery: runNlQueryMock };
});

function renderWith(panel: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{panel}</QueryClientProvider>);
}

beforeEach(() => runNlQueryMock.mockReset());

describe('<NlQueryPanel />', () => {
  it('renders the textarea + Ask button', () => {
    renderWith(<NlQueryPanel onRunAsPicker={vi.fn()} />);
    expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument();
  });

  it('submits the question via the runNlQuery service call', async () => {
    const matched: NlQueryResponse = {
      status: 'matched',
      reportCode: 'admissions-funnel',
      params: { from: '2026-04-01', to: '2026-04-30' },
      runId: 'r1',
      results: [],
      rationale: 'You asked about April funnel.',
      llmModel: 'claude',
      costInr: 0.4,
    };
    runNlQueryMock.mockResolvedValueOnce(matched);

    renderWith(<NlQueryPanel onRunAsPicker={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'april funnel' } });
    fireEvent.click(screen.getByRole('button', { name: /ask/i }));

    await waitFor(() => expect(runNlQueryMock).toHaveBeenCalledWith('april funnel'));
  });

  it('shows the matched banner + rationale + Run-as-picker button', async () => {
    runNlQueryMock.mockResolvedValueOnce({
      status: 'matched',
      reportCode: 'admissions-funnel',
      params: { from: '2026-04-01', to: '2026-04-30' },
      runId: 'r1', results: [],
      rationale: 'You asked about April funnel.',
      llmModel: 'claude', costInr: 0.4,
    } satisfies NlQueryResponse);

    renderWith(<NlQueryPanel onRunAsPicker={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /ask/i }));

    await screen.findByText(/Auto-selected/i);
    expect(screen.getByText(/admissions-funnel/i)).toBeInTheDocument();
    expect(screen.getByText(/You asked about April funnel/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run as picker/i })).toBeInTheDocument();
  });

  it('shows refused banner + supported-reports chips', async () => {
    runNlQueryMock.mockResolvedValueOnce({
      status: 'refused',
      reason: 'Library overdues are not a supported report in v1.',
      supportedReports: ['admissions-funnel', 'lead-source-performance', 'student-roster-snapshot'],
      llmModel: 'claude', costInr: 0.1,
    } satisfies NlQueryResponse);

    renderWith(<NlQueryPanel onRunAsPicker={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /ask/i }));

    await screen.findByText(/Library overdues/i);
    expect(screen.getByText('admissions-funnel')).toBeInTheDocument();
    expect(screen.getByText('lead-source-performance')).toBeInTheDocument();
    expect(screen.getByText('student-roster-snapshot')).toBeInTheDocument();
  });

  it('Run as picker fires onRunAsPicker with reportCode + params', async () => {
    const onRunAsPicker = vi.fn();
    runNlQueryMock.mockResolvedValueOnce({
      status: 'matched',
      reportCode: 'admissions-funnel',
      params: { from: '2026-04-01', to: '2026-04-30' },
      runId: 'r1', results: [],
      rationale: 'r',
      llmModel: 'claude', costInr: 0.4,
    } satisfies NlQueryResponse);

    renderWith(<NlQueryPanel onRunAsPicker={onRunAsPicker} />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /ask/i }));

    const btn = await screen.findByRole('button', { name: /run as picker/i });
    fireEvent.click(btn);
    expect(onRunAsPicker).toHaveBeenCalledWith('admissions-funnel', { from: '2026-04-01', to: '2026-04-30' });
  });

  it('shows an amber cap-reached banner when reason === "cap_reached"', async () => {
    runNlQueryMock.mockResolvedValueOnce({
      status: 'refused',
      reason: 'cap_reached',
      supportedReports: ['admissions-funnel', 'lead-source-performance', 'student-roster-snapshot'],
      llmModel: 'n/a', costInr: 0, capReached: true,
    } satisfies NlQueryResponse);

    renderWith(<NlQueryPanel onRunAsPicker={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /ask/i }));

    await screen.findByText(/daily.*cap.*reached/i);
  });

  it('Ask button disabled while the request is pending', async () => {
    let resolveFn: (v: NlQueryResponse) => void = () => {};
    runNlQueryMock.mockReturnValueOnce(new Promise<NlQueryResponse>((res) => { resolveFn = res; }));

    renderWith(<NlQueryPanel onRunAsPicker={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'q' } });
    const askBtn = screen.getByRole('button', { name: /ask/i });
    fireEvent.click(askBtn);
    await waitFor(() => expect(askBtn).toBeDisabled());

    resolveFn({
      status: 'refused', reason: 'x',
      supportedReports: ['admissions-funnel', 'lead-source-performance', 'student-roster-snapshot'],
      llmModel: 'm', costInr: 0,
    });
    await waitFor(() => expect(askBtn).not.toBeDisabled());
  });
});
