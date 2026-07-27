import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Changing this value resets the boundary — used to clear errors on navigation. */
  resetKey?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors anywhere below it so a single bad component
 * shows a recoverable panel instead of a blank white screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div role="alert" className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-full bg-red-50 p-2 text-red-600">
              <AlertTriangle size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900">Something went wrong</h2>
              <p className="mt-1 text-sm text-slate-600">
                This section failed to render. You can retry, or head back to the dashboard.
              </p>
              {import.meta.env.DEV && (
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-red-700">
                  {error.message}
                </pre>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={this.reset}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
                >
                  <RefreshCw size={14} /> Try again
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/'; }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Home size={14} /> Go to dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
