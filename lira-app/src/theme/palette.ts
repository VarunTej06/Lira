/**
 * Fixed colours used as data: chart series, type and status badges, avatars, priority icons.
 * Change a colour here, not at every call site. (Theme colours that follow light/dark mode live in index.css and tailwind.config.js.)
 */
const palette = {
  brand: '#0052CC',
  textMuted: '#6B778C',
  success: '#36B37E',
  purple: '#6554C0',
  textStrong: '#172B4D',
  danger: '#FF5630',
  info: '#00B8D9',
  border: '#DFE1E6',
  link: '#0C66E4',
  ink: '#1D2939',
  surfaceMuted: '#F4F5F7',
  warning: '#E2740B',
  critical: '#DE350B',
  successSoft: '#22A06B',
  successDeep: '#00875A',
  amber: '#FFAB00',
  criticalDeep: '#C9372C',
  textFaint: '#97A0AF',
  criticalBg: '#FFEBE6',
  orange: '#FF991F',
  orangeDeep: '#FF8B00',
  brandBg: '#DEEBFF',
  night: '#0C1018',
};

export const PALETTE: Readonly<Record<keyof typeof palette, string>> = Object.freeze(palette);
