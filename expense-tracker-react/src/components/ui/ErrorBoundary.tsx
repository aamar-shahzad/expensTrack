import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)]">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-lg font-semibold mb-2 text-center">Something went wrong</h1>
          <p className="text-[var(--text-secondary)] text-center text-sm mb-6 max-w-sm">
            An unexpected error occurred. Reload the app to continue.
          </p>
          <Button onClick={this.handleReload}>Reload</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
