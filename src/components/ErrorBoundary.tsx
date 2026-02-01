import React from "react";
import { Link } from "react-router-dom";
import { pushErrorLog } from "@/utils/errorLogBuffer";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const message = [error.toString(), errorInfo.componentStack].filter(Boolean).join("\n");
    pushErrorLog(message);
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
          <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
          <p className="text-muted-foreground text-center max-w-md">
            An unexpected error occurred. You can try reloading the page or go back home.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90"
            >
              Reload
            </button>
            <Link
              to="/"
              className="px-4 py-2 rounded-md border border-input bg-background font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Go home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
