import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inlineHtml } from '../scripts/single-file';

function fixture(js: string, css: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'filtre-ia-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'a.js'), js);
  writeFileSync(join(dir, 'assets', 'a.css'), css);
  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'"><title>T</title>
<script type="module" crossorigin src="./assets/a.js"></script>
<link rel="stylesheet" crossorigin href="./assets/a.css"></head><body><div id="app"></div></body></html>`,
  );
  return dir;
}

const hash = (s: string) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

describe('build en fichier unique', () => {
  it('inline script et style, avec une CSP à empreintes exactes', () => {
    const js = 'console.log("a$&b");';
    const css = 'body{color:red}';
    const html = inlineHtml(fixture(js, css));
    expect(html).toContain(`<script type="module">${js}</script>`);
    expect(html).toContain(`<style>${css}</style>`);
    expect(html).toContain(`script-src ${hash(js)}`);
    expect(html).toContain(`style-src ${hash(css)}`);
    expect(html).not.toMatch(/src="|href="/);
    expect(html).not.toContain('unsafe-inline');
    expect(html).not.toContain("'self'");
    expect(html.match(/Content-Security-Policy/g)).toHaveLength(1);
  });

  it('échappe « </script » dans le code, et l\'empreinte porte sur le code échappé', () => {
    const js = 'const s = "</script><b>";';
    const html = inlineHtml(fixture(js, 'a{}'));
    const escaped = 'const s = "<\\/script><b>";';
    expect(html).toContain(`<script type="module">${escaped}</script>`);
    expect(html).toContain(hash(escaped));
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('refuse un index.html sans script ou sans feuille de style', () => {
    const dir = mkdtempSync(join(tmpdir(), 'filtre-ia-'));
    writeFileSync(join(dir, 'index.html'), '<html><head></head><body></body></html>');
    expect(() => inlineHtml(dir)).toThrow();
  });
});
