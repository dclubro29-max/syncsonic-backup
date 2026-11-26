import React from 'react';
import { AlertTriangle } from 'lucide-react';

const UserNotRegisteredError = () => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 studio-ambient" aria-hidden="true" />
      <div className="panel relative w-full max-w-md p-7 sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="caps mb-2">Acces restricționat</p>
          <h1 className="screen-title mb-3">Cont neînregistrat</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            Nu ai acces la această aplicație. Contactează administratorul pentru a cere acces.
          </p>
          <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-left text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Dacă crezi că e o eroare:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>verifică faptul că ești conectat cu contul corect;</li>
              <li>cere accesul administratorului aplicației;</li>
              <li>încearcă să te deconectezi și să te conectezi din nou.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;