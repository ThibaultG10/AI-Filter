import { describe, expect, it } from 'vitest';
import { normalizeKey, normalizeWithMap } from '../src/core/normalize';

describe('normalizeWithMap', () => {
  it('met en minuscules et retire les accents, avec une correspondance 1 pour 1', () => {
    const n = normalizeWithMap('Élodie');
    expect(n.text).toBe('elodie');
    expect(n.startOf).toEqual([0, 1, 2, 3, 4, 5]);
    expect(n.endOf).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('rattache un accent combinant au caractère précédent', () => {
    const n = normalizeWithMap('Élodie');
    expect(n.text).toBe('elodie');
    expect(n.startOf[0]).toBe(0);
    expect(n.endOf[0]).toBe(2); // « E » + accent
    expect(n.startOf[1]).toBe(2);
  });

  it('réduit toute suite d\'espaces et de retours à la ligne à une seule espace', () => {
    const n = normalizeWithMap('a  \n b');
    expect(n.text).toBe('a b');
    expect(n.startOf).toEqual([0, 1, 5]);
    expect(n.endOf).toEqual([1, 5, 6]);
  });

  it('traite l\'espace insécable comme une espace', () => {
    expect(normalizeWithMap('a b').text).toBe('a b');
  });

  it('unifie les apostrophes et les tirets typographiques', () => {
    expect(normalizeWithMap('l’école').text).toBe("l'ecole");
    expect(normalizeWithMap('a–b—c').text).toBe('a-b-c');
  });

  it('gère le « İ » turc sans changer la longueur', () => {
    expect(normalizeWithMap('İstanbul').text).toBe('istanbul');
  });

  it('gère les paires de substitution (emoji)', () => {
    const n = normalizeWithMap('😀a');
    expect(n.text).toBe('😀a');
    expect(n.startOf).toEqual([0, 0, 2]);
    expect(n.endOf).toEqual([2, 2, 3]);
  });

  it('garde la correspondance quand la décomposition allonge le texte', () => {
    const n = normalizeWithMap('한');
    expect(n.text).toHaveLength(3);
    expect(n.startOf).toEqual([0, 0, 0]);
    expect(n.endOf).toEqual([1, 1, 1]);
  });

  it('accepte le texte vide', () => {
    expect(normalizeWithMap('')).toEqual({ text: '', startOf: [], endOf: [] });
  });
});

describe('normalizeKey', () => {
  it('produit une clé stable, sans espaces en tête ni en queue', () => {
    expect(normalizeKey('  DUPONT   Sa  ')).toBe('dupont sa');
    expect(normalizeKey('Élodie')).toBe(normalizeKey('elodie'));
    expect(normalizeKey(' \n')).toBe('');
  });
});
