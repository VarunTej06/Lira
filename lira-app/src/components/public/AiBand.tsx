import { useInView } from '../../hooks/useInView';
import { DotIcon } from './DotIcon';
import { CHAT_ICON, LIST_ICON, PLUG_ICON } from './dotIcons';
import { PointerDots } from './PointerDots';
import { TypedText } from './TypedText';
import { PAGE_WIDTH } from './styles';

const COLUMNS = [
  { icon: CHAT_ICON, title: 'Viva inside your workflow', text: 'Ask in plain words. Viva finds tickets and drafts changes, and nothing is saved until you approve it.', soon: false },
  { icon: PLUG_ICON, title: 'An MCP server', text: 'Let the AI tools you already use read your spaces and draft changes, with your approval.', soon: true },
  { icon: LIST_ICON, title: 'Every change on record', text: 'An audit trail of who changed what and when, kept apart from the application logs.', soon: true },
] as const;

/**
 * The black band about AI and MCP. It is black in light mode too, like the dark band of the reference. Only the word "anywhere" is typed,
 * letter by letter, and it is typed again every time the band scrolls into view; with reduced motion it simply appears.
 */
export function AiBand() {
  const [headline, inView] = useInView<HTMLHeadingElement>();
  return (
    <section aria-labelledby="ai-title" className="relative overflow-hidden bg-black text-white">
      <PointerDots />
      <div className={`${PAGE_WIDTH} relative py-16 sm:py-20 flex flex-col gap-12`}>
        <h2 id="ai-title" ref={headline} aria-label="Liraspaces for the AI era, connect anywhere" className="self-start max-w-full rounded-xl bg-white/10 border border-white/15 px-5 py-4 font-mono text-2xl sm:text-5xl leading-tight">
          <span className="block">Liraspaces for the AI era</span>
          <span className="flex items-center">
            <span className="text-white/60 mr-3">&gt;</span>
            <span className="whitespace-pre">connect </span>
            <span data-typing={inView} className="whitespace-nowrap text-logo-gold">{inView && <TypedText text="anywhere" />}</span>
            <span aria-hidden="true" className="ml-1 w-3 sm:w-4 h-6 sm:h-10 bg-logo-gold animate-caret" />
          </span>
        </h2>

        <div>
          <p className="text-xs font-bold tracking-widest mb-3">WORKS WITH</p>
          <div className="flex flex-wrap items-center gap-3 text-sm font-mono">
            <span className="rounded-lg border border-white/25 px-3 py-2">Any MCP agent</span>
            <span className="text-white/70">Coming soon. More tools are named here once they are tested.</span>
          </div>
        </div>

        <div className="grid gap-10 md:grid-cols-3">
          {COLUMNS.map(c => (
            <div key={c.title} className="flex flex-col gap-4">
              <DotIcon rows={c.icon} />
              <h3 className="text-2xl font-bold tracking-tight">{c.title}</h3>
              {c.soon && <span className="self-start text-3xs font-bold tracking-widest rounded border border-white/30 px-2 py-0.5">COMING SOON</span>}
              <p className="text-white/80">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
