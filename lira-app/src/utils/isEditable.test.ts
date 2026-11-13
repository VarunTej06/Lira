import { afterEach, describe, expect, it } from 'vitest';
import { isEditable } from './isEditable';

afterEach(() => { document.body.innerHTML = ''; });

const el = (html: string, selector: string) => { document.body.innerHTML = html; return document.querySelector(selector); };

describe('isEditable', () => {
  it('is true in text boxes and dropdowns', () => {
    expect(isEditable(el('<input />', 'input'))).toBe(true);
    expect(isEditable(el('<textarea></textarea>', 'textarea'))).toBe(true);
    expect(isEditable(el('<select></select>', 'select'))).toBe(true);
  });

  it('is true anywhere inside a rich text editor (the comment box is not an input)', () => {
    expect(isEditable(el('<div contenteditable="true"><p><b id="x">hi</b></p></div>', '#x'))).toBe(true);
    expect(isEditable(el('<div contenteditable=""><p id="x">hi</p></div>', '#x'))).toBe(true);
  });

  it('is false on the page itself, on buttons and with nothing focused', () => {
    expect(isEditable(el('<button>ok</button>', 'button'))).toBe(false);
    expect(isEditable(el('<div contenteditable="false"><p id="x">hi</p></div>', '#x'))).toBe(false);
    expect(isEditable(document.body)).toBe(false);
    expect(isEditable(null)).toBe(false);
    expect(isEditable(undefined)).toBe(false);
  });
});
