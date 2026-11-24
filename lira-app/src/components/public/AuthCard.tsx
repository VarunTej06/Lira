import type { ReactNode } from 'react';

/** The frame of the account pages that are only a short form or a message: a centred card under the site's top bar. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex justify-center px-4 py-14">
      <div className="w-full max-w-sm bg-lira-surface border border-lira-border rounded-lg p-6 flex flex-col gap-3.5">
        <h1 className="text-base font-bold text-center">{title}</h1>
        {children}
      </div>
    </div>
  );
}
