import { describe, expect, it } from 'vitest';
import { safeHttpUrl } from './safeUrl';

describe('a link people paste', () => {
  it('keeps a web link, tidied by the browser, and only that', () => {
    expect(safeHttpUrl('https://github.com/lira/app')).toBe('https://github.com/lira/app');
    expect(safeHttpUrl('  http://example.com  ')).toBe('http://example.com/');
    expect(safeHttpUrl('https://x.io/a b')).toBe('https://x.io/a%20b');
  });
  it('refuses anything that could run script, anything that is not absolute, and nothing', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', 'file:///etc/passwd', 'ftp://x.io', '//evil.com', '/relative/path', 'not a url', '', '   ', undefined, null]) {
      expect(safeHttpUrl(bad as string), String(bad)).toBeUndefined();
    }
  });
});
