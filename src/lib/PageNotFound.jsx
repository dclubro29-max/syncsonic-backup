import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Music2 } from 'lucide-react';

/**
 * Pagina pentru adrese inexistente. Trimite un adevărat 404 către crawlere
 * (meta `prerender-status-code`), ca linkurile greșite să nu fie indexate.
 */
export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'prerender-status-code';
    meta.content = '404';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Music2 className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-heading text-6xl font-semibold tracking-tight text-border">404</h1>
        <h2 className="mt-4 font-heading text-xl font-semibold">Pagina nu există</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {pageName ? (
            <>Adresa „{pageName}” nu se află în aplicație.</>
          ) : (
            <>Adresa cerută nu se află în aplicație.</>
          )}
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Înapoi la mixer
        </Link>
      </div>
    </div>
  );
}