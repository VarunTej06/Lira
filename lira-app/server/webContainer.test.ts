import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { securityHeaders } from './guard.ts';

const APP = process.cwd();
const nginx = fs.readFileSync(path.join(APP, 'nginx.conf'), 'utf-8');
const dockerfile = fs.readFileSync(path.join(APP, 'Dockerfile'), 'utf-8');
const workflow = fs.readFileSync(path.join(APP, '..', '.github', 'workflows', 'web-image.yml'), 'utf-8');
const dockerignore = fs.readFileSync(path.join(APP, '.dockerignore'), 'utf-8').split(/\r?\n/);

const csp = () => header('Content-Security-Policy')!;
const header = (name: string) => new RegExp(`add_header ${name} "([^"]*)" always;`).exec(nginx)?.[1];

describe('web container of the hosted edition', () => {
  it('sends every security header the app server sends, with the same values, apart from the content policy', () => {
    for (const [name, value] of Object.entries(securityHeaders(false))) {
      if (name === 'Content-Security-Policy') continue;
      expect(header(name), name).toBe(value);
    }
  });

  it('has a content policy that allows no inline script, no eval, no framing and no outside connection', () => {
    const csp = header('Content-Security-Policy')!;
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' ${STORAGE_ORIGIN};"); // the page may talk to itself and to the one storage address, nothing else
  });

  it('fills in the storage address from the environment, and the image has an empty default so the policy stays valid without one', () => {
    expect(dockerfile).toMatch(/^ENV STORAGE_ORIGIN=$/m);
    expect(csp()).not.toContain('blob.core.windows.net'); // the address comes from the environment, never from the file
    expect(csp()).not.toContain('*');
  });

  it('asks browsers to use HTTPS only', () => {
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d{7,}/);
  });

  it('answers /health and /ready, and sends unknown addresses to the single-page app', () => {
    expect(nginx).toMatch(/location = \/health \{[^}]*return 200/);
    expect(nginx).toMatch(/location = \/ready\s+\{[^}]*return 200/);
    expect(nginx).toContain('try_files $uri $uri/ /index.html;');
  });

  it('forwards /api/ to the API under the API\'s own name, never under the web app\'s Host header', () => {
    const block = /location \/api\/ \{([\s\S]*?)\n {2}\}/.exec(nginx)?.[1] ?? '';
    expect(block).toContain('proxy_pass http://${API_UPSTREAM};');
    expect(block).not.toMatch(/^\s*proxy_set_header Host /m);
    expect(block).toContain('X-Forwarded-For');
    expect(block).toContain('client_max_body_size');
  });

  it('hides dotfiles and its own version', () => {
    expect(nginx).toContain('server_tokens off;');
    expect(nginx).toMatch(/location ~ \/\\\. \{ deny all; \}/);
  });

  it('puts no header directive inside a location that would drop the server-level ones', () => {
    const inLocations = nginx.split('\n').filter(l => /^\s*location /.test(l) && /add_header/.test(l));
    expect(inLocations).toEqual([]);
  });

  it('builds the hosted edition, runs as a normal user on 8080, and has a health check', () => {
    expect(dockerfile).toContain('vite build --mode hosted');
    expect(dockerfile).toContain('nginx-unprivileged');
    expect(dockerfile).toContain('EXPOSE 8080');
    expect(dockerfile).toMatch(/HEALTHCHECK .*\/health/);
    expect(nginx).toContain('listen 8080;');
  });

  it('keeps the workspace data, keys and local settings out of the build', () => {
    for (const entry of ['data', '.env', '.env.*', 'node_modules', '.git']) expect(dockerignore, entry).toContain(entry);
    expect(dockerfile).not.toMatch(/COPY[^\n]*data/);
  });

  it('has an image workflow that is started by hand, reads nothing but its own files, and takes the registry login from secrets', () => {
    expect(workflow).toMatch(/^on:\r?\n\s+workflow_dispatch:/m);
    expect(workflow).not.toMatch(/pull_request/);
    expect(workflow).not.toMatch(/^ {2}push:/m); // a push trigger under `on:`, not the `push: true` of the build step
    expect(workflow).toMatch(/permissions:\r?\n\s+contents: read/);
    for (const name of ['ACR_LOGIN_SERVER', 'ACR_USERNAME', 'ACR_PASSWORD']) expect(workflow).toContain(`secrets.${name}`);
    expect(workflow).not.toMatch(/password:\s*(?!\$\{\{)\S/);
  });
});
