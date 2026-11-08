import { describe, expect, it } from 'vitest';
import { makeEntry, type DirectoryEntry } from '../src/core/directory';
import { exportCsv, exportJson, importCsv, importJson, MAX_ENTRIES } from '../src/core/directory-io';

function entry(term: string, category = 'CLIENT', aliases: string[] = []): DirectoryEntry {
  const r = makeEntry(term, category, aliases);
  if (!r.ok) throw new Error(r.error);
  return r.entry;
}

const SAMPLE: DirectoryEntry[] = [
  entry('Dupont SA', 'CLIENT', ['Dupont S.A.', 'DUPONT']),
  entry('Élodie Martin', 'PERSONNE'),
  entry('Projet Phénix', 'PROJET'),
  entry('srv-prod-01', 'SERVEUR'),
];

describe('JSON', () => {
  it('fait l\'aller-retour sans perte', () => {
    const r = importJson(exportJson(SAMPLE));
    expect(r.errors).toEqual([]);
    expect(r.entries).toEqual(SAMPLE);
  });

  it('accepte un tableau nu et un objet { entries }', () => {
    const items = [{ term: 'Dupont SA', category: 'client' }];
    expect(importJson(JSON.stringify(items)).entries).toEqual([entry('Dupont SA')]);
    expect(importJson(JSON.stringify({ entries: items })).entries).toEqual([entry('Dupont SA')]);
  });

  it('accepte les clés françaises et les alias en texte séparé par « | »', () => {
    const r = importJson(JSON.stringify([{ terme: 'Dupont SA', categorie: 'client', alias: 'Dupont S.A.|DUPONT' }]));
    expect(r.entries).toEqual([entry('Dupont SA', 'CLIENT', ['Dupont S.A.', 'DUPONT'])]);
  });

  it('applique la catégorie INTERNE quand elle manque', () => {
    expect(importJson('[{"term":"Dupont SA"}]').entries[0]?.category).toBe('INTERNE');
    expect(importJson('[{"term":"Dupont SA","category":"  "}]').entries[0]?.category).toBe('INTERNE');
  });

  it('signale les entrées invalides sans bloquer les valides', () => {
    const r = importJson(
      JSON.stringify([{ term: 'Dupont SA' }, 'texte', { category: 'CLIENT' }, { term: 'X' }, { term: 'Martin', category: 'a b!' }, { term: 'Durand', aliases: [1] }]),
    );
    expect(r.entries.map((e) => e.term)).toEqual(['Dupont SA']);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6]);
  });

  it('signale un JSON invalide ou de mauvaise forme', () => {
    expect(importJson('{pas du json').errors[0]).toMatchObject({ line: 0, message: 'JSON invalide.' });
    expect(importJson('{"a":1}').errors[0]?.line).toBe(0);
    expect(importJson('42').entries).toEqual([]);
  });

  it('refuse un import trop gros', () => {
    const big = JSON.stringify(Array.from({ length: MAX_ENTRIES + 1 }, () => ({ term: 'ab' })));
    const r = importJson(big);
    expect(r.entries).toEqual([]);
    expect(r.errors[0]?.message).toContain('Trop d\'entrées');
  });
});

describe('CSV : export', () => {
  it('écrit un en-tête et utilise « ; » par défaut', () => {
    expect(exportCsv([entry('Dupont SA', 'CLIENT', ['Dupont S.A.', 'DUPONT'])])).toBe(
      'terme;categorie;alias\nDupont SA;CLIENT;Dupont S.A.|DUPONT\n',
    );
  });

  it('met entre guillemets les champs avec séparateur ou guillemets', () => {
    const csv = exportCsv([entry('Dupont; "Fils" & Cie')]);
    expect(csv).toContain('"Dupont; ""Fils"" & Cie"');
  });

  it('protège contre l\'injection de formules dans un tableur', () => {
    const csv = exportCsv([entry('=SUM(A1:A9)', 'INTERNE'), entry('+33 6 12 34 56 78', 'INTERNE'), entry('@cmd', 'INTERNE'), entry('-2+3', 'INTERNE')]);
    for (const line of csv.split('\n').slice(1, 5)) expect(line.startsWith("'")).toBe(true);
  });
});

describe('CSV : aller-retour', () => {
  it.each([';', ','])('sans perte avec le séparateur « %s »', (delimiter) => {
    const entries = [...SAMPLE, entry('Dupont; "Fils", & Cie', 'CLIENT', ['Dupont, Fils', 'D "F"'])];
    const r = importCsv(exportCsv(entries, delimiter));
    expect(r.errors).toEqual([]);
    expect(r.entries).toEqual(entries);
  });

  it('retire la protection des formules à l\'import', () => {
    const entries = [entry('=SUM(A1:A9)', 'INTERNE'), entry('+33 6 12 34 56 78', 'INTERNE'), entry('@cmd', 'INTERNE'), entry('-2+3', 'INTERNE')];
    expect(importCsv(exportCsv(entries)).entries).toEqual(entries);
  });
});

describe('CSV : import', () => {
  it('détecte le séparateur « , » et accepte l\'en-tête anglais', () => {
    const r = importCsv('term,category,aliases\nDupont SA,client,Dupont S.A.|DUPONT\n');
    expect(r.entries).toEqual([entry('Dupont SA', 'CLIENT', ['Dupont S.A.', 'DUPONT'])]);
  });

  it('accepte la tabulation', () => {
    expect(importCsv('terme\tcategorie\nDupont SA\tCLIENT').entries).toEqual([entry('Dupont SA')]);
  });

  it('accepte un fichier Excel : BOM, fins de ligne Windows, « ; »', () => {
    const r = importCsv('﻿terme;categorie;alias\r\nDupont SA;client;\r\nMartin;personne;\r\n');
    expect(r.errors).toEqual([]);
    expect(r.entries.map((e) => [e.term, e.category])).toEqual([
      ['Dupont SA', 'CLIENT'],
      ['Martin', 'PERSONNE'],
    ]);
  });

  it('accepte des colonnes dans un autre ordre', () => {
    const r = importCsv('categorie;alias;terme\nclient;Dupont S.A.;Dupont SA\n');
    expect(r.entries).toEqual([entry('Dupont SA', 'CLIENT', ['Dupont S.A.'])]);
  });

  it('accepte un fichier sans en-tête (terme, catégorie, alias)', () => {
    const r = importCsv('Dupont SA;client;Dupont S.A.\nMartin;personne\n');
    expect(r.entries).toEqual([entry('Dupont SA', 'CLIENT', ['Dupont S.A.']), entry('Martin', 'PERSONNE')]);
  });

  it('accepte une simple liste de termes (catégorie INTERNE)', () => {
    const r = importCsv('Dupont SA\nMartin Jean\n');
    expect(r.entries.map((e) => [e.term, e.category])).toEqual([
      ['Dupont SA', 'INTERNE'],
      ['Martin Jean', 'INTERNE'],
    ]);
  });

  it('gère les guillemets doublés et les retours à la ligne dans un champ', () => {
    const r = importCsv('terme;categorie\n"Dupont ""Fils"" SA";CLIENT\n"Dupont\nSA";PROJET\n');
    expect(r.entries.map((e) => e.term)).toEqual(['Dupont "Fils" SA', 'Dupont SA']);
  });

  it('signale les lignes invalides avec leur numéro de ligne', () => {
    const r = importCsv('terme;categorie\nDupont;CLIENT\n;CLIENT\nX;CLIENT\nMartin;a b!\nDurand;PERSONNE\n');
    expect(r.entries.map((e) => e.term)).toEqual(['Dupont', 'Durand']);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5]);
  });

  it('numérote correctement les lignes après un champ sur plusieurs lignes', () => {
    const r = importCsv('terme;categorie\n"Dupont\nSA";CLIENT\nX;CLIENT\n');
    expect(r.entries.map((e) => e.term)).toEqual(['Dupont SA']);
    expect(r.errors.map((e) => e.line)).toEqual([4]);
  });

  it('signale un guillemet non fermé', () => {
    const r = importCsv('terme;categorie\nDupont;CLIENT\n"Martin;PERSONNE\n');
    expect(r.entries.map((e) => e.term)).toEqual(['Dupont']);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 3 });
    expect(r.errors[0]?.message).toContain('Guillemet non fermé');
  });

  it('ignore les lignes vides et accepte un fichier vide', () => {
    expect(importCsv('')).toEqual({ entries: [], errors: [] });
    expect(importCsv('\n\n  \n')).toEqual({ entries: [], errors: [] });
    expect(importCsv('terme;categorie\n\nDupont;CLIENT\n\n').entries).toHaveLength(1);
  });

  it('refuse un import trop gros', () => {
    const big = 'terme;categorie\n' + 'ab;CLIENT\n'.repeat(MAX_ENTRIES + 1);
    const r = importCsv(big);
    expect(r.entries).toEqual([]);
    expect(r.errors[0]?.message).toContain('Trop d\'entrées');
  });
});
