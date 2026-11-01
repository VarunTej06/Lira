import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg m-4 text-sm">
          <p className="font-semibold text-red-700 mb-1">Something went wrong rendering this component.</p>
          <pre className="text-xs text-red-600 whitespace-pre-wrap">{this.state.error?.message}</pre>
          <button
            className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
