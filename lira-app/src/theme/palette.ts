/**
 * Fixed colours used as data: chart series, type and status badges, avatars, priority icons.
 * Change a colour here, not at every call site. (Theme colours that follow light/dark mode live in index.css and tailwind.config.js.)
 * The neutrals are plain greys on purpose, so a badge sits equally well on the cream, off-white and black pages.
 */
const palette = {
  brand: '#0052CC',
  textMuted: '#6B6F76',
  success: '#36B37E',
  purple: '#6554C0',
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

export type ThemeName = 'dark' | 'sorrel' | 'fawn';

interface ThemeSwatches { label: string; note: string; swatches: readonly { name: string; hex: string }[] }

/**
 * The three themes and the three colours each is built from (the owner's reference screens are in docs/04-quality/ui-references).
 * The full set of shades derived from them is in index.css; theme.test.ts fails if the two disagree.
 */
export const THEMES: Readonly<Record<ThemeName, ThemeSwatches>> = Object.freeze({
  dark: {
    label: 'Dark',
    note: 'Black page, silver text, yellow buttons.',
    swatches: [{ name: 'Black', hex: '#0A0A0A' }, { name: 'Silver', hex: '#D9DADC' }, { name: 'Yellow', hex: '#FFC93C' }],
  },
  sorrel: {
    label: 'Sorrel',
    note: 'Off-white page, sage frame, tomato red buttons.',
    swatches: [{ name: 'Sage', hex: '#9CAF88' }, { name: 'Off-White', hex: '#F7F5EF' }, { name: 'Tomato Red', hex: '#E8412C' }],
  },
  fawn: {
    label: 'Fawn',
    note: 'Cream page, brown text, baby blue buttons.',
    swatches: [{ name: 'Brown', hex: '#3B2418' }, { name: 'Cream', hex: '#F2E8DA' }, { name: 'Baby Blue', hex: '#8EC5FF' }],
  },
});
