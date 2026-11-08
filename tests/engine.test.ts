import { describe, expect, it } from 'vitest';
import { compileDirectory, makeEntry, type DirectoryEntry } from '../src/core/directory';
import { analyze } from '../src/core/engine';
import { createDetectors } from '../src/core/detectors';

function entry(term: string, category = 'CLIENT', aliases: string[] = []): DirectoryEntry {
  const r = makeEntry(term, category, aliases);
  if (!r.ok) throw new Error(r.error);
  return r.entry;
}

const dir = (...entries: DirectoryEntry[]) => compileDirectory(entries);
const summary = (text: string, entries: DirectoryEntry[], detectors = createDetectors()) =>
  analyze(text, { detectors, directory: dir(...entries) }).map((m) => [m.category, m.value]);

describe('analyze : sans annuaire', () => {
  it('se comporte comme les détecteurs seuls', () => {
    expect(analyze('jean@example.com')).toEqual([{ start: 0, end: 16, value: 'jean@example.com', category: 'EMAIL' }]);
    expect(analyze('rien à signaler')).toEqual([]);
  });
});

describe('analyze : annuaire + détecteurs', () => {
  it('masque les termes de l\'annuaire et les données détectées', () => {
    expect(summary('Dossier Dupont SA, tel 06 12 34 56 78', [entry('Dupont SA')])).toEqual([
      ['CLIENT', 'Dupont SA'],
      ['TEL', '06 12 34 56 78'],
    ]);
  });

  it('le terme le plus long de l\'annuaire l\'emporte', () => {
    const r = summary('Dossier Dupont SA', [entry('Dupont', 'PERSONNE'), entry('Dupont SA')]);
    expect(r).toEqual([['CLIENT', 'Dupont SA']]);
  });

  it('un terme contenu dans un e-mail ne le découpe pas : l\'e-mail entier est masqué', () => {
    const r = summary('Écrire à jean.dupont@dupont-sa.fr', [entry('Dupont')]);
    expect(r).toEqual([['EMAIL', 'jean.dupont@dupont-sa.fr']]);
  });

  it('un terme contenu dans une URL interne ne la découpe pas', () => {
    const detectors = createDetectors({ internalDomains: ['entreprise.local'] });
    const r = summary('voir https://phenix.entreprise.local/doc', [entry('phenix', 'PROJET')], detectors);
    expect(r).toEqual([['URL_INTERNE', 'https://phenix.entreprise.local/doc']]);
  });

  it('à étendue identique, l\'annuaire l\'emporte sur le détecteur', () => {
    const r = summary('Serveur 192.168.1.1 prêt', [entry('192.168.1.1', 'SERVEUR')]);
    expect(r).toEqual([['SERVEUR', '192.168.1.1']]);
  });

  it('un terme qui contient une donnée détectée l\'emporte (annuaire plus long)', () => {
    const r = summary('Contact : jean@example.com (Jean Martin) ok', [entry('jean@example.com (Jean Martin)', 'PERSONNE')]);
    expect(r).toEqual([['PERSONNE', 'jean@example.com (Jean Martin)']]);
  });

  it('en chevauchement partiel, l\'annuaire l\'emporte (règle du cadrage)', () => {
    // Limite connue : la partie du téléphone hors du terme reste visible.
    const r = summary('tel 06 12 34 56 78 poste 4', [entry('78 poste', 'INTERNE')]);
    expect(r).toEqual([['INTERNE', '78 poste']]);
  });

  it('ignore casse et accents de l\'annuaire dans un texte complet', () => {
    const r = summary('ÉLODIE MARTIN a écrit à elodie.martin@x.fr', [entry('Élodie Martin', 'PERSONNE')]);
    expect(r).toEqual([
      ['PERSONNE', 'ÉLODIE MARTIN'],
      ['EMAIL', 'elodie.martin@x.fr'],
    ]);
  });

  it('renvoie des correspondances triées, cohérentes et sans chevauchement', () => {
    const text = 'Dupont SA (Élodie Martin) : 06 12 34 56 78, elodie@dupont.fr, 10.0.0.1 et Projet Phénix';
    const matches = analyze(text, { directory: dir(entry('Dupont SA'), entry('Élodie Martin', 'PERSONNE'), entry('Projet Phénix', 'PROJET')) });
    expect(matches.length).toBeGreaterThanOrEqual(6);
    matches.forEach((m, i) => {
      expect(text.slice(m.start, m.end)).toBe(m.value);
      if (i > 0) expect(m.start).toBeGreaterThanOrEqual(matches[i - 1]!.end);
    });
  });
});
