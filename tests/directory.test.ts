import { describe, expect, it } from 'vitest';
import {
  compileDirectory,
  findDirectoryMatches,
  makeEntry,
  mergeEntries,
  normalizeCategory,
  type DirectoryEntry,
} from '../src/core/directory';
import { RANK_DIRECTORY } from '../src/core/overlap';

function entry(term: string, category = 'CLIENT', aliases: string[] = []): DirectoryEntry {
  const r = makeEntry(term, category, aliases);
  if (!r.ok) throw new Error(r.error);
  return r.entry;
}

function find(text: string, ...entries: DirectoryEntry[]): string[] {
  return findDirectoryMatches(text, compileDirectory(entries)).map((c) => c.value);
}

describe('normalizeCategory', () => {
  it.each([
    ['client', 'CLIENT'],
    ['CLIENT', 'CLIENT'],
    ['  Personne ', 'PERSONNE'],
    ['Équipe interne', 'EQUIPE_INTERNE'],
    ['a-b', 'A_B'],
    ['projet_2', 'PROJET_2'],
    ['X', 'X'],
  ])('« %s » devient %s', (raw, expected) => expect(normalizeCategory(raw)).toBe(expected));

  it.each(['', '   ', '1abc', 'a b!', '_x', 'A'.repeat(33)])('refuse « %s »', (raw) =>
    expect(normalizeCategory(raw)).toBeNull(),
  );
});

describe('makeEntry', () => {
  it('normalise le terme, la catégorie et les alias', () => {
    const r = makeEntry('  Dupont   SA ', 'client', ['Dupont S.A.', 'dupont sa', 'DUPONT SA', ' ', 'Dupont S.A.']);
    expect(r).toEqual({ ok: true, entry: { term: 'Dupont SA', category: 'CLIENT', aliases: ['Dupont S.A.'] } });
  });

  it('refuse un terme vide, trop court ou trop long', () => {
    for (const term of ['', '   ', 'a', ' é ']) {
      const r = makeEntry(term, 'CLIENT');
      expect(r.ok, `terme « ${term} »`).toBe(false);
    }
    expect(makeEntry('x'.repeat(201), 'CLIENT').ok).toBe(false);
    expect(makeEntry('x'.repeat(200), 'CLIENT').ok).toBe(true);
  });

  it('refuse une catégorie invalide', () => {
    const r = makeEntry('Dupont', 'a b!');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Catégorie invalide');
  });

  it('refuse un alias invalide ou contenant « | »', () => {
    expect(makeEntry('Dupont', 'CLIENT', ['x']).ok).toBe(false);
    expect(makeEntry('Dupont', 'CLIENT', ['a|b']).ok).toBe(false);
  });

  it('accepte jusqu\'à 50 alias', () => {
    const aliases = Array.from({ length: 51 }, (_, i) => `alias numero ${i}`);
    expect(makeEntry('Dupont', 'CLIENT', aliases.slice(0, 50)).ok).toBe(true);
    expect(makeEntry('Dupont', 'CLIENT', aliases).ok).toBe(false);
  });
});

describe('mergeEntries', () => {
  it('ajoute les nouvelles entrées et ignore les termes déjà présents', () => {
    const base = [entry('Dupont SA'), entry('Martin', 'PERSONNE')];
    const incoming = [entry('DUPONT sa', 'PROJET'), entry('Durand', 'PERSONNE')];
    const r = mergeEntries(base, incoming);
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.entries.map((e) => e.term)).toEqual(['Dupont SA', 'Martin', 'Durand']);
    expect(r.entries[0]?.category).toBe('CLIENT'); // l'existant l'emporte
  });
});

describe('compileDirectory', () => {
  it('déduplique les clés et signale les conflits de catégorie', () => {
    const compiled = compileDirectory([entry('Dupont', 'CLIENT'), entry('DUPONT', 'PROJET'), entry('Martin', 'PERSONNE', ['dupont'])]);
    expect(compiled.patterns.map((p) => p.key)).toEqual(['dupont', 'martin']);
    expect(compiled.patterns[0]?.category).toBe('CLIENT');
    expect(compiled.conflicts).toEqual(['dupont']);
  });

  it('un même terme dans la même catégorie n\'est pas un conflit', () => {
    expect(compileDirectory([entry('Dupont'), entry('dupont')]).conflicts).toEqual([]);
  });
});

describe('findDirectoryMatches : casse et accents', () => {
  it('ignore la casse et garde la valeur d\'origine', () => {
    expect(find('Le dossier DUPONT et dupont', entry('Dupont'))).toEqual(['DUPONT', 'dupont']);
  });

  it('ignore les accents dans les deux sens', () => {
    const e = entry('Élodie', 'PERSONNE');
    expect(find('elodie, ÉLODIE, Élodie', e)).toEqual(['elodie', 'ÉLODIE', 'Élodie']);
    expect(find('Élodie', entry('elodie', 'PERSONNE'))).toEqual(['Élodie']);
  });

  it('reconnaît un accent combinant et le garde dans la valeur', () => {
    expect(find('Bonjour Élodie !', entry('Élodie', 'PERSONNE'))).toEqual(['Élodie']);
  });

  it('retrouve un terme à travers espaces multiples, insécables et retours à la ligne', () => {
    const e = entry('Dupont SA');
    expect(find('Dupont\n  SA', e)).toEqual(['Dupont\n  SA']);
    expect(find('Dupont SA', e)).toEqual(['Dupont SA']);
  });

  it('retrouve un terme avec apostrophe ou tiret typographique', () => {
    expect(find('chez l’Oréal', entry("l'Oréal"))).toEqual(['l’Oréal']);
    expect(find('Jean–Paul', entry('Jean-Paul', 'PERSONNE'))).toEqual(['Jean–Paul']);
  });
});

describe('findDirectoryMatches : frontières de mots', () => {
  const dupont = entry('Dupont');

  it.each([
    'Le dossier Dupont est clos',
    'dupont,',
    '(Dupont)',
    'Dupont.',
    "l'Dupont",
    'client_Dupont_id',
    'Dupont-Martin',
    'Dupont\n',
  ])('trouve « Dupont » dans « %s »', (text) => {
    expect(find(text, dupont)).toHaveLength(1);
  });

  it.each(['Dupontel', 'ADupont', 'Dupont2', '2Dupont', 'Mondupont', 'éDupont', 'Dupontéa'])(
    'ne trouve pas « Dupont » dans « %s »',
    (text) => {
      expect(find(text, dupont)).toEqual([]);
    },
  );

  it('n\'exige pas de frontière côté caractère non alphanumérique', () => {
    expect(find('on utilise C++ ici', entry('C++', 'INTERNE'))).toEqual(['C++']);
    expect(find('société S.A.S.Dupont', entry('S.A.S.', 'INTERNE'))).toEqual(['S.A.S.']);
  });

  it('gère les emoji de part et d\'autre', () => {
    expect(find('x😀 team y', entry('😀 team', 'INTERNE'))).toEqual(['😀 team']);
    expect(find('😀team', entry('team', 'INTERNE'))).toEqual(['team']);
  });
});

describe('findDirectoryMatches : alias, positions, champs', () => {
  it('trouve aussi les alias', () => {
    const e = entry('Dupont SA', 'CLIENT', ['Dupont S.A.', 'DUP']);
    expect(find('société Dupont S.A. ici, et DUP aussi', e)).toEqual(['Dupont S.A.', 'DUP']);
  });

  it('renvoie des positions qui pointent vers le texte d\'origine', () => {
    const text = 'Bonjour É́lodie, merci';
    const [c] = findDirectoryMatches(text, compileDirectory([entry('Élodie', 'PERSONNE')]));
    expect(c).toBeDefined();
    expect(text.slice(c!.start, c!.end)).toBe(c!.value);
  });

  it('renvoie rang, catégorie et ordre de déclaration', () => {
    const found = findDirectoryMatches('Martin puis Dupont', compileDirectory([entry('Dupont'), entry('Martin', 'PERSONNE')]));
    const byValue = Object.fromEntries(found.map((c) => [c.value, c]));
    expect(byValue['Dupont']).toMatchObject({ category: 'CLIENT', rank: RANK_DIRECTORY, order: 0 });
    expect(byValue['Martin']).toMatchObject({ category: 'PERSONNE', rank: RANK_DIRECTORY, order: 1 });
  });

  it('renvoie tout de suite pour un annuaire ou un texte vide', () => {
    expect(find('Dupont')).toEqual([]);
    expect(find('', entry('Dupont'))).toEqual([]);
  });

  it('retrouve toutes les occurrences', () => {
    expect(find('Dupont et dupont et DUPONT', entry('Dupont'))).toEqual(['Dupont', 'dupont', 'DUPONT']);
  });
});

describe('findDirectoryMatches : performance', () => {
  it('1 000 termes sur 50 000 caractères en moins de 300 ms', () => {
    const entries = Array.from({ length: 1000 }, (_, i) => entry(`Société${i} Alpha`, 'CLIENT', [`Soc${i}`]));
    const compiled = compileDirectory(entries);
    const paragraph =
      'Bonjour, voici le point sur le dossier de la Société12 Alpha et de Soc345. ' +
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore. ';
    const text = paragraph.repeat(Math.ceil(50_000 / paragraph.length)).slice(0, 50_000);
    const start = performance.now();
    const matches = findDirectoryMatches(text, compiled);
    const elapsed = performance.now() - start;
    expect(matches.length).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(300);
  });

  it('un terme très répétitif sur 50 000 caractères reste rapide', () => {
    const compiled = compileDirectory([entry('aa', 'INTERNE')]);
    const start = performance.now();
    findDirectoryMatches('a'.repeat(50_000), compiled);
    expect(performance.now() - start).toBeLessThan(300);
  });
});
