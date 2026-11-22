import { useEffect } from 'react';
import { LEGAL, DRAFT_DATE, type LegalKey } from './legalText';
import { PAGE_WIDTH } from './styles';

/** One of the legal pages, laid out from its text in legalText.ts. */
export default function LegalPage({ doc }: { doc: LegalKey }) {
  const { title, intro, sections } = LEGAL[doc];
  useEffect(() => { document.title = `${title} · Liraspaces`; }, [title]);
  return (
    <article className={`${PAGE_WIDTH} max-w-3xl py-10 flex flex-col gap-6`}>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p role="note" className="text-xs bg-lira-amber-light border border-lira-border rounded px-3 py-2">
          Draft of {DRAFT_DATE}. This text is not yet reviewed by a lawyer and may change before launch.
        </p>
        <p className="text-lira-muted">{intro}</p>
      </header>
      {sections.map(s => (
        <section key={s.heading} className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{s.heading}</h2>
          {s.paragraphs.map(p => <p key={p} className="text-lira-muted">{p}</p>)}
        </section>
      ))}
    </article>
  );
}
