import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw, RotateCcw } from "lucide-react";

/**
 * Plasă de siguranță pentru interfață: dacă un panou crapă, restul aplicației
 * (și muzica) continuă să funcționeze, iar utilizatorul poate reîncerca.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Interfața a întâmpinat o eroare:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const detail = String(error?.message || error || "").slice(0, 200);

    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/70 p-6 text-center shadow-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-heading text-lg font-semibold">Ceva nu a mers aici</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sunetul nu este afectat. Poți reîncerca sau te poți întoarce la mixer.
        </p>
        {detail && (
          <p className="mt-3 break-words font-mono text-[11px] leading-relaxed text-muted-foreground/70">
            {detail}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => this.setState({ error: null })}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reîncearcă
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reîncarcă
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <Link to="/">
              <Home className="h-3.5 w-3.5" />
              La mixer
            </Link>
          </Button>
        </div>
      </div>
    );
  }
}