import type { ReactNode } from 'react';

/** **bold** and `code` inside a line. */
function formatInline(str: string): ReactNode {
  return str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/60 font-mono text-[10px]">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

const isTableLine = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|');
const cells = (line: string) => line.trim().split('|').slice(1, -1).map(c => c.trim());

function Table({ rows }: { rows: string[][] }) {
  const [headers, ...rest] = rows;
  const body = rest.filter(r => !r.every(c => /^:?-+:?$/.test(c))); // drop the |---|---| line
  return (
    <div className="overflow-x-auto my-2 rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full text-[11px] divide-y divide-gray-200">
        <thead className="bg-gray-50/80 font-bold text-gray-700">
          <tr>{headers.map((h, i) => <th key={i} className="px-2 py-1 text-left font-semibold">{formatInline(h)}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {body.map((row, ri) => (
            <tr key={ri} className="hover:bg-purple-50/30 transition-colors">
              {row.map((cell, ci) => <td key={ci} className="px-2 py-1 text-gray-700">{formatInline(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A small Markdown reader for chat messages: bold, code and tables. */
export function ChatMarkdown({ text }: { text: string }) {
  if (!(text.includes('|') && text.includes('\n|'))) {
    return <div className="space-y-1 font-sans leading-relaxed">{text.split('\n').map((line, i) => <div key={i}>{formatInline(line)}</div>)}</div>;
  }

  // Lines of text, with each run of table lines turned into one table
  const blocks: ReactNode[] = [];
  let rows: string[][] = [];
  const flush = (key: string) => { if (rows.length) blocks.push(<Table key={key} rows={rows} />); rows = []; };
  text.split('\n').forEach((line, idx) => {
    if (isTableLine(line)) { rows.push(cells(line)); return; }
    flush(`table-${idx}`);
    if (line.trim()) blocks.push(<div key={idx} className="my-0.5 leading-relaxed">{formatInline(line)}</div>);
  });
  flush('table-end');
  return <div className="space-y-0.5 font-sans">{blocks}</div>;
}
