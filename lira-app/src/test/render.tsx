import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Small helpers for component tests, so they need no extra tools: mount a component into the fake browser (jsdom),
 * click, type, wait, and look things up. Every test file should call `cleanup()` in afterEach.
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export const wait = (ms = 0) => new Promise(r => setTimeout(r, ms));

const mounted: { unmount: () => void }[] = [];

export function mount(element: ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  const handle = {
    host,
    rerender: (el: ReactElement) => act(() => root.render(el)),
    unmount: () => { act(() => root.unmount()); host.remove(); },
  };
  mounted.push(handle);
  return handle;
}

/** Removes everything a test mounted. Call in afterEach. */
export function cleanup() {
  while (mounted.length) mounted.pop()!.unmount();
  document.body.innerHTML = '';
}

export const q = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
export const qa = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(selector));

/** The first button (or other element) whose text matches. */
export const byText = <T extends HTMLElement = HTMLElement>(selector: string, text: string | RegExp, root: ParentNode = document) =>
  qa<T>(selector, root).find(e => (typeof text === 'string' ? e.textContent?.trim() === text : text.test(e.textContent ?? '')));

export async function click(el: Element | null | undefined) {
  if (!el) throw new Error('click: element not found');
  await act(async () => { (el as HTMLElement).click(); await wait(0); });
}

/** Types into an input the way a person does, so React notices. */
export async function typeInto(input: HTMLInputElement | HTMLTextAreaElement | null | undefined, value: string) {
  if (!input) throw new Error('typeInto: input not found');
  await act(async () => {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(0);
  });
}

/** Picks a value in a <select> the way a person does, so React notices. */
export async function choose(select: HTMLSelectElement | null | undefined, value: string) {
  if (!select) throw new Error('choose: select not found');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(0);
  });
}

export async function press(key: string, target: EventTarget = document) {
  await act(async () => { target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); await wait(0); });
}

/** Lets animations and effects settle (framer-motion needs a few frames). */
export async function settle(ms = 60) {
  await act(async () => { await wait(ms); });
}
