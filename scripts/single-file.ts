// Produit un unique fichier HTML autonome à partir de dist/ : script et style en ligne,
// CSP stricte avec empreintes SHA-256 (aucun 'unsafe-inline', aucun domaine autorisé).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const sha256 = (s: string): string => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

export function buildCsp(scriptHash: string, styleHash: string): string {
  return [
    "default-src 'none'",
    `script-src ${scriptHash}`,
    `style-src ${styleHash}`,
    "img-src data:",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

export function inlineHtml(distDir: string): string {
  let html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const read = (ref: string): string => readFileSync(join(distDir, ref.replace(/^\.?\//, '')), 'utf8');

  const scriptTag = /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/;
  const linkTag = /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/;
  const scriptMatch = scriptTag.exec(html);
  const linkMatch = linkTag.exec(html);
  if (!scriptMatch || !linkMatch) throw new Error('index.html : script ou feuille de style introuvable');

  // Un « </script » dans le code fermerait la balise trop tôt ; on l'échappe de façon équivalente.
  const js = read(scriptMatch[1] ?? '').replace(/<\/(script)/gi, '<\\/$1');
  const css = read(linkMatch[1] ?? '').replace(/<\/(style)/gi, '<\\/$1');

  html = html.replace(linkMatch[0], () => '').replace(scriptMatch[0], () => '');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, '');
  const csp = buildCsp(sha256(js), sha256(css));
  html = html.replace(
    '<head>',
    () => `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
  );
  html = html.replace('</head>', () => `<style>${css}</style>\n  </head>`);
  html = html.replace('</body>', () => `<script type="module">${js}</script>\n  </body>`);
  return html;
}

export function writeSingleFile(distDir: string, outFile: string): string {
  const html = inlineHtml(distDir);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, 'utf8');
  return outFile;
}
