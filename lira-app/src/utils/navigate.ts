/** Leaves the page for another address with a full load. A seam so tests can watch where the page goes. */
export const goTo = (url: string): void => { window.location.assign(url); };
