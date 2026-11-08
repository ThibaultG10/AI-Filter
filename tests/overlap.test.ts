import { describe, expect, it } from 'vitest';
import { RANK_DETECTOR, RANK_DIRECTORY, resolveOverlaps, type Candidate } from '../src/core/overlap';

function cand(start: number, end: number, category: string, rank = RANK_DETECTOR, order = 0): Candidate {
  return { start, end, value: 'x'.repeat(end - start), category, rank, order };
}

const categories = (candidates: Candidate[], length = 40): string[] =>
  resolveOverlaps(candidates, length).map((m) => m.category);

describe('resolveOverlaps : règles générales', () => {
  it('garde deux correspondances disjointes, triées par position', () => {
    expect(categories([cand(10, 15, 'B'), cand(0, 5, 'A')])).toEqual(['A', 'B']);
  });

  it('considère deux correspondances adjacentes comme disjointes', () => {
    expect(categories([cand(0, 5, 'A'), cand(5, 8, 'B')])).toEqual(['A', 'B']);
  });

  it('en cas de chevauchement, la plus longue l\'emporte', () => {
    expect(categories([cand(0, 5, 'COURT'), cand(2, 12, 'LONG')])).toEqual(['LONG']);
  });

  it('à longueur égale, l\'ordre de déclaration départage', () => {
    expect(categories([cand(0, 6, 'SECOND', RANK_DETECTOR, 2), cand(0, 6, 'PREMIER', RANK_DETECTOR, 1)])).toEqual(['PREMIER']);
  });

  it('retire les candidats vides', () => {
    expect(categories([cand(3, 3, 'VIDE')])).toEqual([]);
  });

  it('ne produit jamais de chevauchement', () => {
    const out = resolveOverlaps([cand(0, 10, 'A'), cand(5, 15, 'B'), cand(12, 20, 'C'), cand(18, 25, 'D'), cand(1, 3, 'E')], 30);
    for (let i = 1; i < out.length; i++) expect(out[i]!.start).toBeGreaterThanOrEqual(out[i - 1]!.end);
  });

  it('ne garde que les champs de Match', () => {
    const [m] = resolveOverlaps([cand(0, 3, 'A')], 5);
    expect(Object.keys(m!).sort()).toEqual(['category', 'end', 'start', 'value']);
  });
});

describe('resolveOverlaps : annuaire et détecteurs', () => {
  it('l\'annuaire l\'emporte en cas de chevauchement partiel, même s\'il est plus court', () => {
    // détecteur [0,10) ; annuaire [8,12) : l'annuaire gagne et le détecteur disparaît
    expect(categories([cand(0, 10, 'DETECTEUR'), cand(8, 12, 'ANNUAIRE', RANK_DIRECTORY)])).toEqual(['ANNUAIRE']);
    expect(categories([cand(8, 12, 'DETECTEUR'), cand(0, 10, 'ANNUAIRE', RANK_DIRECTORY)])).toEqual(['ANNUAIRE']);
  });

  it('à étendue identique, l\'annuaire l\'emporte', () => {
    expect(categories([cand(0, 10, 'DETECTEUR'), cand(0, 10, 'ANNUAIRE', RANK_DIRECTORY)])).toEqual(['ANNUAIRE']);
  });

  it('l\'annuaire l\'emporte quand il contient le détecteur', () => {
    expect(categories([cand(5, 8, 'DETECTEUR'), cand(0, 20, 'ANNUAIRE', RANK_DIRECTORY)])).toEqual(['ANNUAIRE']);
  });

  it('un détecteur qui contient entièrement un terme d\'annuaire l\'emporte (rien ne fuit)', () => {
    // contenu strictement : début plus tôt, fin plus tard, ou les deux
    expect(categories([cand(0, 20, 'DETECTEUR'), cand(5, 8, 'ANNUAIRE', RANK_DIRECTORY)])).toEqual(['DETECTEUR']);
    expect(categories([cand(0, 20, 'DETECTEUR'), cand(0, 8, 'ANNUAIRE', RANK_DIRECTORY)])).toEqual(['DETECTEUR']);
    expect(categories([cand(0, 20, 'DETECTEUR'), cand(10, 20, 'ANNUAIRE', RANK_DIRECTORY)])).toEqual(['DETECTEUR']);
  });

  it('plusieurs termes d\'annuaire dans un même détecteur : le détecteur l\'emporte', () => {
    const out = categories([cand(0, 30, 'DETECTEUR'), cand(2, 6, 'A1', RANK_DIRECTORY), cand(10, 14, 'A2', RANK_DIRECTORY)]);
    expect(out).toEqual(['DETECTEUR']);
  });

  it('entre deux termes d\'annuaire, le plus long l\'emporte', () => {
    expect(categories([cand(0, 5, 'COURT', RANK_DIRECTORY, 0), cand(0, 12, 'LONG', RANK_DIRECTORY, 1)])).toEqual(['LONG']);
  });

  it('garde les termes d\'annuaire disjoints des détecteurs', () => {
    expect(categories([cand(0, 5, 'DETECTEUR'), cand(10, 15, 'ANNUAIRE', RANK_DIRECTORY)])).toEqual(['DETECTEUR', 'ANNUAIRE']);
  });
});
