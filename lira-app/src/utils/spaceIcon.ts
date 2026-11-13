import { PALETTE } from '../theme/palette';

/**
 * The icon of a space. It is saved as a short name ('rocket') and drawn by components/common/SpaceIcon.
 * Spaces made before 13 Nov 2026 saved an emoji instead: those are shown as the matching icon, and nothing that is
 * already saved is rewritten.
 */
export const SPACE_ICON_KEYS = [
  'clipboard', 'sparkles', 'trophy', 'book', 'cloud', 'rocket', 'lightbulb', 'target', 'wrench', 'globe', 'brain', 'zap',
  'folder', 'briefcase', 'code', 'shield', 'users', 'megaphone', 'flask', 'palette', 'server', 'graduation', 'building', 'database',
] as const;

export type SpaceIconKey = typeof SPACE_ICON_KEYS[number];

export const DEFAULT_SPACE_ICON: SpaceIconKey = 'folder';

// The emoji older spaces saved, written as code points so the source itself holds no emoji (hygiene.test.ts)
const LEGACY_EMOJI = new Map<string, SpaceIconKey>([
  ['\u{1F4CB}', 'clipboard'], ['\u{2728}', 'sparkles'], ['\u{1F3C6}', 'trophy'], ['\u{1F4DA}', 'book'],
  ['\u{1F324}', 'cloud'], ['\u{1F680}', 'rocket'], ['\u{1F4A1}', 'lightbulb'], ['\u{1F3AF}', 'target'],
  ['\u{1F527}', 'wrench'], ['\u{1F310}', 'globe'], ['\u{1F9E0}', 'brain'], ['\u{26A1}', 'zap'], ['\u{1F4C1}', 'folder'],
]);

const KEYS: ReadonlySet<string> = new Set(SPACE_ICON_KEYS);

/** The icon to draw for whatever a space has saved: a name, an older emoji, or nothing. */
export function spaceIconKey(saved: string | null | undefined): SpaceIconKey {
  const value = (saved ?? '').replace(/\u{FE0F}/gu, '').trim(); // some emoji carry an invisible "show as picture" mark
  if (KEYS.has(value)) return value as SpaceIconKey;
  return LEGACY_EMOJI.get(value) ?? DEFAULT_SPACE_ICON;
}

/**
 * Spaces no longer have a colour of their own: their tiles use the colours of the theme. A space still saves a colour,
 * so that backups and older versions keep working; a new space gets this neutral one.
 */
export const SPACE_COLOR = PALETTE.textMuted;
