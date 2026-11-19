/** Class names shared by the public pages. The colours are the theme's own, so light mode is Sorrel and dark mode is Pace. */
const BUTTON = 'inline-flex items-center justify-center rounded px-4 py-2.5 text-ui font-bold border transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lira-blue';

export const BTN = `${BUTTON} bg-lira-blue text-lira-on-blue border-lira-blue hover:bg-lira-blue-hover`;
export const BTN_GHOST = `${BUTTON} bg-transparent text-lira-text border-lira-border hover:border-lira-muted`;
export const BTN_DISABLED = `${BUTTON} bg-transparent text-lira-muted border-lira-border cursor-not-allowed`;
export const LINK = 'text-lira-text underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lira-blue';
export const PAGE_WIDTH = 'w-full max-w-6xl mx-auto px-4 sm:px-7';
