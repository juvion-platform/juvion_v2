import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * The public account-deletion page for the Juvi app (a Play listing requirement).
 *
 * A public route — it sits outside `RequireCollege` in App.tsx, like `/login` and
 * `/privacy-policy`, so an anonymous visitor (someone who has uninstalled the app, a Play
 * reviewer) reaches it without a session. Nothing here calls the app's API client.
 *
 * The form is a **native** HTML form: it posts `application/x-www-form-urlencoded` to
 * `/api/juvi-app/v1/account-deletion`, and the route mounts its own `express.urlencoded` to
 * parse it. `action` is relative, so the POST is same-origin; the route's CSRF guard
 * (`isSameOriginSubmission`) requires `Origin` in `ALLOWED_ORIGINS` and `Sec-Fetch-Site:
 * same-origin` — exactly what a same-origin form POST presents. Submission is the browser's
 * own, so the inputs are left uncontrolled (no `value`/`onChange`) and there is no `onSubmit`
 * handler to intercept it.
 *
 * This page replaced a former static `public/account-deletion.html`, which was script-free so
 * the form worked with JavaScript disabled (011 Story 3 AC9). As a React route the page now
 * requires JS to render, so it must be reached from an origin that is proxied to the API
 * (the portal's own host serves both `/account-deletion` and `/api`), preserving the
 * same-origin guarantee the form relies on.
 */
export default function AccountDeletion() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Delete your Juvi account';
    return () => {
      document.title = previous;
    };
  }, []);

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-primary-500 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-600';
  const hintClass = 'mt-1 mb-1.5 text-sm text-slate-500';
  const labelClass = 'mt-4 block font-semibold text-slate-900';

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <main className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <header>
            <h1 className="text-2xl font-bold text-slate-900">Delete your Juvi account</h1>
            <p className="mt-2 text-slate-600">
              Juvi is the student and faculty app for your college. Use this page to ask for your
              Juvi account to be deleted — you do not need the app installed, and you do not need to
              sign in.
            </p>
          </header>

          <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Delete my account</h2>
            <p className="mt-2 text-slate-700">
              Enter the details you normally sign in to Juvi with. We check them the same way the app
              does, then schedule the deletion.
            </p>
            <form
              method="post"
              action="/api/juvi-app/v1/account-deletion"
              encType="application/x-www-form-urlencoded"
            >
              <label htmlFor="institutionCode" className={labelClass}>
                Institution code
              </label>
              <p className={hintClass} id="institutionCode-hint">
                The code you enter in the app at sign-in. Ask your college office if you do not know
                it.
              </p>
              <input
                id="institutionCode"
                name="institutionCode"
                type="text"
                required
                maxLength={32}
                autoComplete="off"
                aria-describedby="institutionCode-hint"
                className={inputClass}
              />

              <label htmlFor="identifier" className={labelClass}>
                Roll number or employee code
              </label>
              <p className={hintClass} id="identifier-hint">
                Whatever you use to sign in to Juvi.
              </p>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                maxLength={120}
                autoComplete="username"
                aria-describedby="identifier-hint"
                className={inputClass}
              />

              <label htmlFor="password" className={labelClass}>
                Juvi password
              </label>
              <p className={hintClass} id="password-hint">
                The password you sign in to Juvi with.
              </p>
              <input
                id="password"
                name="password"
                type="password"
                required
                maxLength={200}
                autoComplete="current-password"
                aria-describedby="password-hint"
                className={inputClass}
              />

              <button
                type="submit"
                className="mt-6 w-full rounded-lg bg-red-700 px-4 py-3 text-base font-semibold text-white hover:bg-red-800 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                Delete my Juvi account
              </button>
            </form>
          </section>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <p className="text-slate-700">
              <strong>Your account is not removed immediately.</strong> Submitting this form records
              the request and the confirmation that follows gives the exact date your account will be
              removed. Until that date you can cancel the request by signing in to the app, or by
              asking your college office.
            </p>
            <p className="mt-3 text-slate-700">
              If it was not you who asked, sign in to Juvi as soon as you can — signing in or changing
              your password cancels a pending request.
            </p>
          </div>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">What is deleted</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-6 text-slate-700">
            <li>Your Juvi account itself: its profile, its settings and notification preferences.</li>
            <li>Your signed-in devices, which are signed out everywhere.</li>
            <li>Your membership of Juvi spaces and your notification history.</li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">What is not deleted</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-6 text-slate-700">
            <li>
              Your college's own records. Your admission, academic, attendance and fee records belong
              to the college and are not touched by this — deleting your Juvi account does not remove
              you from the college.
            </li>
            <li>
              Notices and messages you published to others, which stay with the people who received
              them.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Getting access back</h2>
          <p className="mt-2 text-slate-700">
            If you delete your Juvi account by mistake, your college can set it up again for you. That
            creates a fresh account with a new temporary password, and it does not restore what was
            deleted — so contact your college office instead if you only want to stop the deletion.
          </p>

          <footer className="mt-10 border-t border-slate-200 pt-4 text-sm text-slate-500">
            Juvi is developed by Juvion. This page is for account deletion requests only. See also the{' '}
            <Link to="/privacy-policy" className="font-medium text-primary-600 underline-offset-2 hover:underline">
              privacy policy
            </Link>
            .
          </footer>
        </div>
      </main>
    </div>
  );
}
