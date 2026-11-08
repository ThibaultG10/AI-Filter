import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// CSP stricte injectée uniquement au build : en dev, Vite a besoin de scripts
// inline pour le rechargement à chaud, qu'une CSP stricte bloquerait.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function strictCsp(): Plugin {
  return {
    name: 'strict-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`,
      );
    },
  };
}

export default defineConfig({
  plugins: [strictCsp()],
  base: './',
  build: { target: 'es2022' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
