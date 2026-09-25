import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import Login from '../Login';
import { renderWithProviders } from '../../__tests__/test-utils';

vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }));

describe('Login', () => {
  it('toggles password visibility without losing the typed value', () => {
    renderWithProviders(<Login />);
    const input = screen.getByLabelText('Password', { exact: true }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'juvi@1234' } });
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input.value).toBe('juvi@1234');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('keeps the toggle out of form submission', () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('type', 'button');
  });
});
