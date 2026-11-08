import { pathFor, routeForTab, spacePath } from '../routes';

/**
 * Lira's screens are buttons and rows, not plain links, so the browser cannot offer "Open in new tab" by itself.
 * An element that carries `data-href` gets the Lira link menu on right-click (Open in new tab, Copy link),
 * opens in a new tab on middle-click, and on Ctrl/Cmd + click. See components/common/LinkMenu.tsx.
 *
 *   <button onClick={...} {...issueLink(issue)}>
 */

export const linkProps = (href?: string | null): { 'data-href'?: string } => (href ? { 'data-href': href } : {});

/** A ticket opens as the popup over its own space's board. */
export const issueHref = (key: string) => {
  const cut = key.lastIndexOf('-');
  const space = cut > 0 ? key.slice(0, cut) : key;
  return `${spacePath(space, 'Board')}?issue=${encodeURIComponent(key)}`;
};

export const issueLink = (issue: { key: string } | undefined | null) => linkProps(issue?.key ? issueHref(issue.key) : undefined);
export const sprintLink = (key: string | undefined) => linkProps(key ? `/sprints/${key}` : undefined);
export const projectLink = (id: string | undefined) => linkProps(id ? `/projects/${encodeURIComponent(id)}` : undefined);
export const roadmapLink = (id: string | undefined) => linkProps(id ? `/roadmaps/${encodeURIComponent(id)}` : undefined);
export const spaceLink = (key: string | undefined, tab = 'Board') => linkProps(key ? spacePath(key, tab) : undefined);
/** A sidebar or top bar page, by page name ("Projects", "SprintsHub", "ForYou"...). */
export const pageLink = (tab: string | undefined) => linkProps(tab ? pathFor(routeForTab(tab)) : undefined);
