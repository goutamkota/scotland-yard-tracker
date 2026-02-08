import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
            <div className="text-4xl mb-4">💥</div>
            <h2 className="font-display text-xl font-bold mb-2 text-accent">Something went wrong</h2>
            <p className="text-muted-foreground font-mono text-xs mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
