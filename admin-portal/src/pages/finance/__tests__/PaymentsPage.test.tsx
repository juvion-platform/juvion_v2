/**
 * 007 T12 — PaymentsPage. Locks in the two structural changes: the status edit control
 * is GONE (counter capture is always success) and the create modal offers invoice
 * allocation. Payload-shape (no status, applies to invoice) is enforced + tested on the
 * backend; here we prove the UI contract without brittle full-form submission.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

import PaymentsPage from '../PaymentsPage';
import { renderWithProviders } from '../../../__tests__/test-utils';

// Guardian enforcement off (demo default) so the block never gates the modal.
vi.mock('../../../config/flags', () => ({ FINANCE_ENFORCE_FEE_GUARDIAN: false }));
vi.mock('../../../services/finance', () => ({
  listPayments: vi.fn(), createPayment: vi.fn(), updatePayment: vi.fn(), deletePayment: vi.fn(), listInvoices: vi.fn(),
}));
vi.mock('../../../services/people', () => ({ getStudent: vi.fn(), listStudents: vi.fn() }));

import { listPayments, listInvoices } from '../../../services/finance';
import { listStudents, getStudent } from '../../../services/people';

beforeEach(() => {
  (listPayments as Mock).mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
  (listStudents as Mock).mockResolvedValue({ items: [{ _id: 's1', person: { name: 'Alice' }, rollNumber: 'R1' }] });
  (getStudent as Mock).mockResolvedValue({ _id: 's1', feeResponsibleParentId: null });
  (listInvoices as Mock).mockResolvedValue({ items: [{ _id: 'inv1', invoiceNumber: 'INV-1', totalAmount: 45000, netPayable: 45000, status: 'generated', createdAt: '2025-01-01' }] });
});

describe('<PaymentsPage />', () => {
  it('create modal drops the status control and offers invoice allocation', async () => {
    renderWithProviders(<PaymentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /New Payment/i }));

    // Invoice allocation is present…
    expect(await screen.findByText(/Apply to invoice/i)).toBeInTheDocument();
    // …and the old "Status *" edit field is gone (the list's status FILTER stays, but has no "*").
    expect(screen.queryByText(/^Status \*$/)).not.toBeInTheDocument();
  });

  it('lists the student open invoices in the allocation dropdown', async () => {
    renderWithProviders(<PaymentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /New Payment/i }));
    // Select the student so the open-invoices query enables.
    const studentSelect = (await screen.findAllByRole('combobox')).find((el) =>
      Array.from((el as HTMLSelectElement).options).some((o) => /Select student/i.test(o.textContent || '')));
    fireEvent.change(studentSelect as HTMLSelectElement, { target: { value: 's1' } });

    expect(await screen.findByRole('option', { name: /INV-1/ })).toBeInTheDocument();
  });
});
