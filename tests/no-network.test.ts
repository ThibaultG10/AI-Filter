import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Garde-fou statique : aucun appel réseau ni eval dans le code source.
// Le test e2e « zéro requête sortante » viendra au jalon 6.
const FORBIDDEN = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bsendBeacon\b/,
  /\bEventSource\b/,
  /\beval\s*\(/,
  /\bnew Function\s*\(/,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|js|html)$/.test(name) ? [path] : [];
  });
}

describe('zéro réseau (garde-fou statique)', () => {
  const files = sourceFiles('src');

  it('trouve des fichiers source à analyser', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const re of FORBIDDEN) {
    it(`aucune occurrence de ${re}`, () => {
      const offenders = files.filter((f) => re.test(readFileSync(f, 'utf8')));
      expect(offenders).toEqual([]);
    });
  }
});
