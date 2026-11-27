import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What a visitor to the hosted site can and cannot reach. The red error page of the development server shows source code, so the
 * hosted site must never run it: it is the built bundle behind nginx, with no source maps and no way to fetch a source file.
 */
const root = join(__dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n');

describe('the hosted site shows no source code', () => {
  it('builds without source maps', () => {
    expect(read('vite.config.ts')).toMatch(/build:\s*\{\s*sourcemap:\s*false\s*\}/);
  });

  it('is served from the built files only, by nginx, and never by the development server', () => {
    const docker = read('Dockerfile');
    const last = docker.slice(docker.lastIndexOf('FROM '));
    expect(last).toContain('nginx');
    expect(last).toContain('COPY --from=build /app/dist /usr/share/nginx/html');
    expect(last).not.toMatch(/COPY \. |COPY src|node_modules|npm run dev|vite/); // the last stage holds no source, no packages and no dev server
    expect(last).not.toMatch(/CMD .*(vite|npm)/);
  });

  it('refuses source maps and hidden files if one ever got into the folder', () => {
    const nginx = read('nginx.conf');
    expect(nginx).toMatch(/location ~\* \\\.map\$ \{ return 404; \}/);
    expect(nginx).toMatch(/location ~ \/\\\. \{ deny all; \}/);
  });

  it('keeps the development server out of the hosted deploy scripts', () => {
    const script = readFileSync(join(root, '..', 'infra', 'azure-playground', 'Setup-Playground.ps1'), 'utf8');
    expect(script).not.toMatch(/npm run dev|vite --host|dev:hosted/);
  });
});
