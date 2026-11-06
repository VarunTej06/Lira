import React, { Component, type ReactNode } from 'react';

interface FallbackContext { error?: Error; reset: () => void }

interface Props {
  children: ReactNode;
  /** What to show instead of the content after an error. A function gets the error and a `reset` that tries again. */
  fallback?: ReactNode | ((ctx: FallbackContext) => ReactNode);
}
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Lira ErrorBoundary]', error, info);
  }
  reset = () => this.setState({ hasError: false, error: undefined });
  render() {
    if (!this.state.hasError) return this.props.children;
    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback({ error: this.state.error, reset: this.reset });
    return fallback ?? (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg m-4 text-sm">
        <p className="font-semibold text-red-700 mb-1">Something went wrong rendering this component.</p>
        <pre className="text-xs text-red-600 whitespace-pre-wrap">{this.state.error?.message}</pre>
        <button className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700" onClick={this.reset}>
          Retry
        </button>
      </div>
    );
  }
}
