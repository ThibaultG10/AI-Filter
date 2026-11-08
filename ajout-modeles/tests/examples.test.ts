import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importCsv } from '../src/core/directory-io';

// Les modèles fournis doivent s'importer sans aucune erreur (BOM, en-tête, alias compris).
describe.each(['examples/annuaire-modele.csv', 'examples/directory-template.csv', 'examples/annuaire.csv'])('%s', (file) => {
  const result = importCsv(readFileSync(file, 'utf8'));

  it('s\'importe sans erreur', () => {
    expect(result.errors).toEqual([]);
    expect(result.entries.length).toBeGreaterThanOrEqual(4);
  });

  it('contient des alias et plusieurs catégories', () => {
    expect(result.entries.some((e) => e.aliases.length > 0)).toBe(true);
    expect(new Set(result.entries.map((e) => e.category)).size).toBeGreaterThanOrEqual(3);
  });
});

describe('modèles bilingues', () => {
  it('ont le même nombre d\'entrées', () => {
    const fr = importCsv(readFileSync('examples/annuaire-modele.csv', 'utf8'));
    const en = importCsv(readFileSync('examples/directory-template.csv', 'utf8'));
    expect(en.entries).toHaveLength(fr.entries.length);
  });

  it('commencent par un BOM UTF-8 pour que les accents s\'ouvrent bien dans Excel', () => {
    for (const file of ['examples/annuaire-modele.csv', 'examples/directory-template.csv']) {
      expect(readFileSync(file)[0]).toBe(0xef);
    }
  });
});
