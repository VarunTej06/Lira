/** Two small line icons for the public pages, drawn here so the page does not pull in the app's icon set. */
const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function ChevronIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" className={className} {...LINE}><path d="M3.5 6l4.5 4.5L12.5 6" /></svg>;
}

export function SunIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true" className={className} {...LINE}><circle cx="10" cy="10" r="3.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" /></svg>;
}

export function MoonIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true" className={className} {...LINE}><path d="M16.5 11.5A7 7 0 018.5 3.5 7 7 0 1016.5 11.5z" /></svg>;
}

export function SearchIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true" className={className} {...LINE}><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>;
}
