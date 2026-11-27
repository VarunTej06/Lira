import type { Level } from '../../services/accessApi';
import { LEVEL_LABEL } from '../../utils/accessRows';

const TONE: Record<Level, string> = { view: 'bg-gray-100 text-lira-text', edit: 'bg-lira-teal-light text-lira-text', manage: 'bg-lira-amber-light text-lira-text' };

/** A level as a small coloured label. The word is always there, so colour is never the only signal. */
export function LevelPill({ level }: { level: Level }) {
  return <span className={`inline-block rounded-md px-2 py-0.5 text-2xs font-semibold ${TONE[level]}`}>{LEVEL_LABEL[level]}</span>;
}
