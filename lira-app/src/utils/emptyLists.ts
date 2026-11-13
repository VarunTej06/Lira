import type { Issue } from '../types/issue';

/**
 * One shared empty list. `useLiveQuery(...) || []` makes a new array every render while data loads, which defeats every
 * useMemo that depends on it; this constant keeps the same identity. Never push into it.
 */
export const NO_ISSUES: Issue[] = [];
