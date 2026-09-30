import i18n from '../../i18n';
import { Component, Suspense } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/** Per-page error boundary (Section 11): a broken page never blanks the app. */
export class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page failed to render:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk =
      /dynamically imported module|Loading chunk|Importing a module script failed/i.test(
        String(this.state.error?.message)
      );
    return (
      <div
        role="alert"
        className="max-w-xl mx-auto mt-10 bg-white border border-line rounded-xl shadow-sm p-6 text-sm"
      >
        <div className="flex items-center gap-2 text-royal-900 font-bold">
          <AlertTriangle className="w-5 h-5 text-[#E8871E]" aria-hidden="true" />
          {chunk ? i18n.t('boundary.updated_title') : i18n.t('boundary.error_title')}
        </div>
        <p className="text-ink-600 mt-2 text-xs">
          {chunk
            ? i18n.t('boundary.updated_body')
            : String(this.state.error?.message || this.state.error)}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-1.5 bg-royal-700 hover:bg-royal-900 text-white text-xs font-medium px-3 py-2 rounded-lg"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> {i18n.t('boundary.reload')}
        </button>
      </div>
    );
  }
}

function PageFallback() {
  return <div className="p-6 text-sm text-royal-700 animate-pulse">Loading…</div>;
}

/** Suspense + error boundary wrapper for a routed page. */
export function Page({ children }) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </PageErrorBoundary>
  );
}
