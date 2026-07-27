import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error Boundary exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[220px] p-6 m-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-main-text flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 rounded-full bg-rose-500/20 text-rose-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-rose-400">
              {this.props.fallbackTitle || 'Component Error Caught'}
            </h3>
            <p className="text-xs text-muted-text mt-1 max-w-md">
              A temporary glitch occurred rendering this section. Your records remain safe.
            </p>
            {this.state.error && (
              <p className="text-[10px] font-mono text-rose-300/80 bg-rose-950/40 p-2 rounded mt-2 border border-rose-500/20 max-w-lg break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold transition cursor-pointer border border-rose-500/30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
