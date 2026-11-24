import { useState } from 'react';
import { importWorkspace, type ImportReport } from '../../services/hostedImport';
import { countOf, parseImportFiles, type ParsedImport, type PickedFile } from '../../utils/importWorkspace';
import { BUTTON } from './teamsUi';

/** Files the importer never reads: the folder of secrets, backups, and anything that is not JSON. */
const wanted = (file: File): boolean => {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return file.name.endsWith('.json') && !/(^|\/)private\//.test(path) && !file.name.endsWith('.bak');
};

/** Brings a workspace from the local edition into this organisation: choose its files, see what is in them, then import. */
export function ImportTab({ org }: { org: string }) {
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  async function pick(list: FileList | null) {
    setReport(null);
    const files: PickedFile[] = await Promise.all([...(list ?? [])].filter(wanted).map(async f => ({ name: f.name, text: await f.text() })));
    setParsed(files.length ? parseImportFiles(files) : null);
  }
  async function run() {
    if (!parsed) return;
    setProgress([0, 1]);
    const result = await importWorkspace(org, parsed.bundle, (done, total) => setProgress([done, total]));
    setProgress(null); setParsed(null); setReport(result);
  }
  const counts = parsed ? countOf(parsed.bundle) : null;

  return (
    <section aria-label="Import" className="space-y-4 text-ui">
      <p className="text-lira-muted">Bring in a workspace you kept in the local edition. Choose the <code>lira-workspace.json</code> file, or the files of its <code>data</code> folder. Spaces and tickets get new numbers and keys here; projects, roadmaps and dashboards come with them. Files attached to tickets are not imported. Nothing leaves your browser until you press Import.</p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">Files<input type="file" multiple accept=".json,application/json" onChange={e => { void pick(e.target.files); }} /></label>
        <label className="flex flex-col gap-1">Or a data folder<input type="file" multiple {...{ webkitdirectory: '' }} onChange={e => { void pick(e.target.files); }} /></label>
      </div>
      {parsed && counts && (
        <div role="status" className="border border-lira-border rounded-lg p-3 space-y-2">
          <p>Found <strong>{counts.spaces}</strong> spaces, <strong>{counts.tickets}</strong> tickets, <strong>{counts.projects}</strong> projects, <strong>{counts.roadmaps}</strong> roadmaps and <strong>{counts.dashboards}</strong> dashboards.</p>
          {[...parsed.problems, ...parsed.ignored.map(i => `Not used: ${i}`)].map(line => <p key={line} className="text-lira-muted">{line}</p>)}
          <button type="button" disabled={progress !== null || counts.spaces + counts.projects + counts.roadmaps + counts.dashboards === 0} onClick={() => { void run(); }} className={BUTTON}>
            {progress ? `Importing ${progress[0]} of ${progress[1]}` : 'Import'}
          </button>
        </div>
      )}
      {report && (
        <div role="status" className="border border-lira-border rounded-lg p-3 space-y-1">
          <p className="font-bold">Imported {report.made.spaces} spaces, {report.made.tickets} tickets, {report.made.projects} projects, {report.made.roadmaps} roadmaps and {report.made.dashboards} dashboards.</p>
          {report.problems.length > 0 && <p>{report.problems.length} things were not imported:</p>}
          <ul className="list-disc pl-5 text-lira-muted">{report.problems.slice(0, 30).map(p => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
