import { useEffect, useState } from 'react';
import type { ObjectKind } from '../services/accessApi';
import { listObjects, listSpaces } from '../services/workspaceApi';
import type { Choice, ObjectChoices } from '../utils/accessRows';

const OTHER_KINDS = ['project', 'roadmap', 'dashboard', 'storybox', 'mindmap'] as const;

const docName = (doc: Record<string, unknown>, id: string): string => (typeof doc.name === 'string' && doc.name ? doc.name : id);

/** Every space, project, roadmap, dashboard, story box and storyboard of the organisation by name, for choosing what to give access to. Null while loading. */
export function useObjectChoices(org: string): ObjectChoices | null {
  const [found, setFound] = useState<{ org: string; choices: ObjectChoices } | null>(null);
  useEffect(() => {
    let current = true;
    void (async () => {
      const [spaces, ...others] = await Promise.all([listSpaces(org), ...OTHER_KINDS.map(k => listObjects(org, k))]);
      if (!current) return;
      const choices = { space: spaces.ok ? spaces.data.map((s): Choice => ({ id: String(s.id), name: `${s.name} (${s.key})` })) : [] } as ObjectChoices;
      OTHER_KINDS.forEach((k: Exclude<ObjectKind, 'space'>, i) => { const r = others[i]; choices[k] = r.ok ? r.data.map((o): Choice => ({ id: o.id, name: docName(o.doc, o.id) })) : []; });
      setFound({ org, choices });
    })();
    return () => { current = false; };
  }, [org]);
  return found?.org === org ? found.choices : null;
}
