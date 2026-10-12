import { useEffect } from 'react';

/**
 * The hosted privacy policy for the Juvi Android app (a Play listing requirement).
 *
 * A public route — it sits outside `RequireCollege` in App.tsx, like `/login`, so an
 * anonymous visitor (a Play reviewer, someone who has not installed the app) reaches it
 * without a session. Nothing here calls the API.
 *
 * The deletion page it links to is a *static* file (`public/account-deletion.html`) and
 * must stay that way — it posts a native, script-free form. This page carries no such
 * constraint, so it lives here in the app instead.
 */
const LAST_UPDATED = '12 October 2026';

export default function PrivacyPolicy() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Privacy Policy — Juvi';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <main className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-2xl font-bold text-slate-900">Privacy Policy — Juvi</h1>
          <p className="mt-1 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

          <p className="mt-6 text-slate-700">
            Juvi is the mobile app for a college that runs on the Juvion platform. Your college
            operates the app for its students and faculty; Juvion provides the platform. This policy
            explains what the Juvi app collects, why, and the choices you have. It does not cover the
            college's own academic and financial records, which are governed by the college.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-6 text-slate-700">
            <li>
              <strong>Account and sign-in data.</strong> The name and identifiers your college already
              holds for you (roll number or employee code), and the device sessions created when you
              sign in.
            </li>
            <li>
              <strong>Device push registration.</strong> A per-device token so the app can receive
              notifications, and its status while your account exists.
            </li>
            <li>
              <strong>Notification activity.</strong> Which notices were sent to you, whether they were
              delivered, opened or acknowledged.
            </li>
            <li>
              <strong>App usage events.</strong> Server-side events recording which notices you saw and
              acknowledged, used to operate the service.
            </li>
            <li>
              <strong>Profile photo.</strong> If you upload one, it is stored on your college person
              record, not kept only on the device.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">How we use it</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-6 text-slate-700">
            <li>Sign you in and show your timetable, teaching, dues and academics.</li>
            <li>Deliver notices and notifications, and show their reach and acknowledgements.</li>
            <li>Keep the service secure and diagnose crashes.</li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Sharing</h2>
          <p className="mt-2 text-slate-700">
            Notifications are delivered through <strong>Firebase Cloud Messaging</strong> and crash
            reports are collected by <strong>Firebase Crashlytics</strong>, both Google services, and
            the app is distributed through <strong>Google Play</strong>. We do not sell your data.
            Notification content is not placed in the push payload's title or body for confidential
            notices.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Retention</h2>
          <p className="mt-2 text-slate-700">
            Your Juvi data is kept while your account exists. Deleting your Juvi account removes the
            data described on the deletion page below. Your college's own records (person, student or
            faculty records, fees and the rest) are retained by the college under its record-keeping
            obligations and are not deleted by removing your Juvi account.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Your choices</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-6 text-slate-700">
            <li>Control notification tiers, mute, and quiet hours in the app's Settings.</li>
            <li>Ask for your Juvi account to be deleted — see the deletion page.</li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Account deletion</h2>
          <p className="mt-2 text-slate-700">
            You can delete your Juvi account from inside the app (immediately) or by requesting
            deletion on the web:{' '}
            <a
              href="/account-deletion.html"
              className="font-medium text-primary-600 underline-offset-2 hover:underline"
            >
              Delete your Juvi account
            </a>
            . A web request takes effect after a 7-day grace period, which gives you time to cancel a
            request you did not make.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Children</h2>
          <p className="mt-2 text-slate-700">
            Juvi is for the enrolled students and staff of the college and is not directed at children
            outside that roll.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Contact</h2>
          <p className="mt-2 text-slate-700">
            Questions about this policy:{' '}
            <a
              href="mailto:privacy@juvion.in"
              className="font-medium text-primary-600 underline-offset-2 hover:underline"
            >
              privacy@juvion.in
            </a>
            .
          </p>

          <footer className="mt-10 border-t border-slate-200 pt-4 text-sm text-slate-500">
            Juvion — Juvi mobile app.
          </footer>
        </div>
      </main>
    </div>
  );
}
