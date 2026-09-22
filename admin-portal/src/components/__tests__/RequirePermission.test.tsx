import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import RequirePermission from '../RequirePermission';
import { useAuthStore } from '../../stores/authStore';
import { renderWithProviders } from '../../__tests__/test-utils';

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>home</div>} />
      <Route path="/finance" element={<RequirePermission module="finance"><div>finance page</div></RequirePermission>} />
    </Routes>
  );
}

describe('RequirePermission', () => {
  beforeEach(() => useAuthStore.setState({ permissions: [] }));

  it('renders children when the permission is held', () => {
    useAuthStore.setState({ permissions: ['finance:read'] });
    renderWithProviders(<App />, { route: '/finance' });
    expect(screen.getByText('finance page')).toBeInTheDocument();
  });
  it('redirects home when it is not', () => {
    renderWithProviders(<App />, { route: '/finance' });
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText('finance page')).toBeNull();
  });
});
