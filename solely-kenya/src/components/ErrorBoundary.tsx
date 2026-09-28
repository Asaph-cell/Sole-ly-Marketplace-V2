import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CloudOff, RefreshCw } from "lucide-react";
import { friendlyError } from "@/lib/friendlyError";

// After a deploy, an open tab can ask for a code chunk that no longer exists.
const isStaleChunk = (e: Error | null) =>
  !!e && /dynamically imported module|loading chunk|importing a module script failed|failed to fetch dynamically/i.test(e.message);

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <CloudOff strokeWidth={1.5} className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                {isStaleChunk(this.state.error) ? "Solely just got an update" : "This page hit a snag"}
              </h1>
              <p className="text-muted-foreground">
                {isStaleChunk(this.state.error)
                  ? "Reload to get the latest version. Your cart is saved."
                  : friendlyError(this.state.error, "Something unexpected happened. Reloading usually fixes it, and your cart is saved.")}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleReset} size="lg" className="gap-2">
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
              <Button onClick={this.handleHome} size="lg" variant="outline">
                Go to homepage
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
