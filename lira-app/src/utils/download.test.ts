import { describe, expect, it, vi } from 'vitest';
import { downloadFile } from './download';

describe('saving text as a file', () => {
  it('makes a file of the text with its name and kind, clicks it, and lets the temporary address go', () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => { created.push(b as Blob); return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    const clicked: HTMLAnchorElement[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
    downloadFile('a,b\n1,2', 'tickets.csv', 'text/csv');
    expect(created[0].type).toBe('text/csv');
    expect(created[0].size).toBe(7);
    expect(clicked[0].download).toBe('tickets.csv');
    expect(clicked[0].href).toBe('blob:x');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });
});
