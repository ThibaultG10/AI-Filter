import type { Match } from './types';

/** Rang des candidats : le plus petit l'emporte en cas de chevauchement partiel. */
export const RANK_DIRECTORY = 0;
export const RANK_DETECTOR = 1;

/** Correspondance candidate, avant résolution des chevauchements. */
export interface Candidate extends Match {
  /** RANK_DIRECTORY (annuaire) l'emporte sur RANK_DETECTOR (détecteurs automatiques). */
  rank: number;
  /** Ordre de déclaration, pour départager deux candidats de même rang et de même longueur. */
  order: number;
}

/**
 * Écarte les correspondances d'annuaire entièrement contenues dans une correspondance plus
 * longue d'un autre rang : masquer la plus longue masque aussi le terme (ex. « dupont » dans
 * « jean.dupont@example.com » : l'e-mail entier est masqué, pas seulement le nom).
 * À étendue identique, l'annuaire est conservé.
 */
function dropDirectoryMatchesInsideLongerOnes(candidates: readonly Candidate[]): Candidate[] {
  const others = candidates
    .filter((c) => c.rank !== RANK_DIRECTORY && c.end > c.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  if (others.length === 0) return [...candidates];

  const prefixMaxEnd: number[] = [];
  let max = -1;
  for (const o of others) {
    max = Math.max(max, o.end);
    prefixMaxEnd.push(max);
  }

  const lowerBound = (start: number): number => {
    let lo = 0;
    let hi = others.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (others[mid]!.start < start) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const isInsideLongerOne = (c: Candidate): boolean => {
    const idx = lowerBound(c.start);
    // Un autre candidat qui commence strictement avant et finit au moins aussi tard.
    if (idx > 0 && prefixMaxEnd[idx - 1]! >= c.end) return true;
    // Un autre candidat qui commence au même endroit mais finit strictement après.
    const same = others[idx];
    return same !== undefined && same.start === c.start && same.end > c.end;
  };

  return candidates.filter((c) => c.rank !== RANK_DIRECTORY || !isInsideLongerOne(c));
}

/**
 * Garde un ensemble de correspondances sans chevauchement.
 * Priorité : un terme d'annuaire entièrement contenu dans une correspondance plus longue d'un
 * détecteur est écarté ; sinon rang (annuaire avant détecteurs), puis longueur la plus grande,
 * puis ordre de déclaration, puis position. Résultat trié par position.
 */
export function resolveOverlaps(candidates: readonly Candidate[], textLength: number): Match[] {
  const sorted = dropDirectoryMatchesInsideLongerOnes(candidates)
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.rank - b.rank || b.end - b.start - (a.end - a.start) || a.order - b.order || a.start - b.start);

  const taken = new Uint8Array(textLength);
  const kept: Match[] = [];
  for (const c of sorted) {
    let free = true;
    for (let i = c.start; i < c.end; i++) {
      if (taken[i] === 1) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    taken.fill(1, c.start, c.end);
    kept.push({ start: c.start, end: c.end, value: c.value, category: c.category });
  }
  return kept.sort((a, b) => a.start - b.start);
}
