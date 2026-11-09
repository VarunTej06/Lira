const CHECK = /^- \[([ xX])\] /;

/** One line of the notes: a heading, a checklist item, a bullet, a numbered item, a blank gap or a paragraph. */
function PreviewLine({ line }: { line: string }) {
  if (line.startsWith('### ')) return <h3 className="text-sm font-bold text-lira-text mt-2 mb-1">{line.slice(4)}</h3>;
  if (line.startsWith('## ')) return <h2 className="text-base font-bold text-lira-text mt-3 mb-1.5">{line.slice(3)}</h2>;
  if (line.startsWith('# ')) return <h1 className="text-xl font-bold text-lira-text border-b pb-1 mt-3 mb-2">{line.slice(2)}</h1>;
  const check = CHECK.exec(line);
  if (check) {
    const done = check[1] !== ' ';
    return (
      <div className={`flex items-center gap-2 my-0.5 text-xs ${done ? 'text-gray-500 line-through' : 'text-lira-text'}`}>
        <input type="checkbox" checked={done} readOnly className="rounded text-lira-blue" />
        <span>{line.slice(6)}</span>
      </div>
    );
  }
  if (/^[-*] /.test(line)) return <li className="text-xs text-lira-text ml-4 list-disc my-0.5">{line.slice(2)}</li>;
  if (/^\d+\.\s/.test(line)) return <li className="text-xs text-lira-text ml-4 list-decimal my-0.5">{line.replace(/^\d+\.\s/, '')}</li>;
  if (line.trim() === '') return <div className="h-2" />;
  return <p className="text-xs text-lira-text leading-relaxed my-1">{line}</p>;
}

/** A small reader for the notes: headings, checklists, bullets, numbers and paragraphs. */
export function MarkdownPreview({ text }: { text: string }) {
  return <>{text.split('\n').map((line, idx) => <PreviewLine key={idx} line={line} />)}</>;
}
