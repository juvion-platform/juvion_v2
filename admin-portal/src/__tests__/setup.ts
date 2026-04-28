/**
 * Vitest setup — runs once before each test file.
 *
 * - Wires `@testing-library/jest-dom` matchers (toBeInTheDocument, etc.)
 *   into vitest's `expect`.
 * - Auto-cleans the DOM between tests so leftover renders from one test
 *   don't pollute the next.
 * - Mocks `window.matchMedia` (Tailwind responsive utilities call it
 *   transitively under jsdom) and `URL.createObjectURL` /
 *   `URL.revokeObjectURL` (used by file-upload components).
 */

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom doesn't ship matchMedia; some components / lucide icons read it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},        // legacy
      removeListener: () => {},     // legacy
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// PersonPhotoBlock uses these for its file-preview modal.
if (typeof URL !== 'undefined') {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => 'blob:mock-object-url';
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = () => {};
  }
}
