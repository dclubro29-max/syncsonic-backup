import React from 'react';
import { Link } from 'react-router-dom';
import { LogIn, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CalibrationLoginPrompt({ code }) {
  const returnTo = `/calibrate?c=${encodeURIComponent(code || '')}`;
  return (
    <div className="studio-ambient min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg flex-col justify-center">
        <div className="panel p-5 sm:p-6">
          <p className="caps">SyncSonic · calibrare</p>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-semibold tracking-[-0.03em]">
            <Smartphone className="h-5 w-5 text-primary" /> Aliniază cu telefonul
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Autentifică-te în același cont SyncSonic ca pe laptop. Sesiunea de calibrare este vizibilă doar contului care a pornit-o.
          </p>
          {code && (
            <p className="mt-3 inline-flex rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 font-mono text-sm tracking-[0.18em] text-primary">
              {code}
            </p>
          )}
          <Button asChild className="mt-5 h-12 w-full gap-2 text-base">
            <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
              <LogIn className="h-5 w-5" /> Autentifică-te
            </Link>
          </Button>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Dacă linkul te duce la pagina principală după autentificare, redeschide codul QR sau lipește linkul din nou.
          </p>
        </div>
      </div>
    </div>
  );
}