import { Navigate, Route, Routes } from 'react-router-dom';
import NoticesPage from './communication/NoticesPage';

/**
 * Communication hub (notices spec §8), gated on `notices:read` in App.tsx.
 * The legacy Announcements and Circulars pages stay under Platform.
 */
export default function Communication() {
  return (
    <Routes>
      <Route index element={<Navigate to="notices" replace />} />
      <Route path="notices" element={<NoticesPage />} />
    </Routes>
  );
}
