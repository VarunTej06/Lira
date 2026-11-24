/**
 * Fixed colours used as data: chart series, type and status badges, avatars, priority icons.
 * Change a colour here, not at every call site. (Theme colours that follow light/dark mode live in index.css and tailwind.config.js.)
 * The neutrals are plain greys on purpose, so a badge sits equally well on the cream, off-white and black pages.
 */
const palette = {
  brand: '#0052CC',
  textMuted: '#6B6F76',
  success: '#36B37E',
  epic: '#8F590B',
  epicBg: '#F6EAD2',
  textStrong: '#2B2D31',
  danger: '#FF5630',
  info: '#00B8D9',
  border: '#E0DFDA',
  link: '#0C66E4',
  ink: '#1D2939',
  surfaceMuted: '#F0EFEA',
  warning: '#E2740B',
  critical: '#DE350B',
  successSoft: '#22A06B',
  successDeep: '#00875A',
  amber: '#FFAB00',
  criticalDeep: '#C9372C',
  textFaint: '#9A9CA1',
  criticalBg: '#FFEBE6',
  orange: '#FF991F',
  orangeDeep: '#FF8B00',
  brandBg: '#DEEBFF',
  night: '#0C1018',
};

export const PALETTE: Readonly<Record<keyof typeof palette, string>> = Object.freeze(palette);

/** The colours an idea in a mind map can be given. */
export const MIND_COLORS: readonly string[] = Object.freeze([PALETTE.brand, PALETTE.success, PALETTE.warning, PALETTE.danger, PALETTE.info, PALETTE.epic, PALETTE.amber, PALETTE.textMuted]);

export type ThemeName = 'pace' | 'blackridge' | 'sorrel' | 'fawn' | 'mossgrove' | 'tidewell';

/** `use` says what the colour paints on the screen, in a few words, for the explanation under the picker. */
interface ThemeSwatches { label: string; note: string; swatches: readonly { name: string; hex: string; use: string }[] }

/**
 * The six palettes (two for dark mode, four for light mode) and the three colours each is built from. The owner's reference
 * screens are in docs/04-quality/ui-references. Which palette belongs to which mode is in utils/theme.ts.
 * The full set of shades derived from them is in index.css; theme.test.ts fails if the two disagree.
 */
export const THEMES: Readonly<Record<ThemeName, ThemeSwatches>> = Object.freeze({
  pace: {
    label: 'Pace',
    note: 'Black page, silver text, yellow buttons.',
    swatches: [{ name: 'Black', hex: '#0A0A0A', use: 'the page and the panels' }, { name: 'Silver', hex: '#D9DADC', use: 'text and thin lines' }, { name: 'Yellow', hex: '#FFC93C', use: 'buttons and the selected item' }],
  },
  blackridge: {
    label: 'Blackridge',
    note: 'Jet black page, smoke grey text, cherry red buttons.',
    swatches: [{ name: 'Jet Black', hex: '#0B0B0C', use: 'the page and the panels' }, { name: 'Smoke Grey', hex: '#8A8D93', use: 'text and thin lines' }, { name: 'Cherry Red', hex: '#C8102E', use: 'buttons and the selected item' }],
  },
  sorrel: {
    label: 'Sorrel',
    note: 'Off-white page, sage frame, tomato red buttons.',
    swatches: [{ name: 'Sage', hex: '#9CAF88', use: 'the frame around the app' }, { name: 'Off-White', hex: '#F7F5EF', use: 'the page and the cards' }, { name: 'Tomato Red', hex: '#E8412C', use: 'buttons and the selected item' }],
  },
  fawn: {
    label: 'Fawn',
    note: 'Cream page, brown text, baby blue buttons.',
    swatches: [{ name: 'Brown', hex: '#3B2418', use: 'text and the navigation' }, { name: 'Cream', hex: '#F2E8DA', use: 'the page and the cards' }, { name: 'Baby Blue', hex: '#8EC5FF', use: 'buttons and the selected item' }],
  },
  mossgrove: {
    label: 'Mossgrove',
    note: 'White cards, emerald navigation and links, tangerine buttons.',
    swatches: [{ name: 'Emerald', hex: '#0F5C45', use: 'the navigation and links' }, { name: 'White', hex: '#FFFFFF', use: 'the cards and panels' }, { name: 'Tangerine', hex: '#F28C28', use: 'buttons and the selected item' }],
  },
  tidewell: {
    label: 'Tidewell',
    note: 'Pearl white page, ink navy text and navigation, electric coral buttons.',
    swatches: [{ name: 'Ink Navy', hex: '#141B2D', use: 'text and the navigation' }, { name: 'Pearl White', hex: '#F4F1EA', use: 'the page and the cards' }, { name: 'Electric Coral', hex: '#FF5A4E', use: 'buttons and the selected item' }],
  },
});
