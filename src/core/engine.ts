import { collectCandidates, DETECTORS } from './detectors';
import { findDirectoryMatches, type CompiledDirectory } from './directory';
import { resolveOverlaps } from './overlap';
import type { Detector, Match } from './types';

export interface AnalyzeOptions {
  /** Détecteurs automatiques (par défaut : DETECTORS). */
  detectors?: readonly Detector[];
  /** Annuaire compilé (par défaut : aucun). */
  directory?: CompiledDirectory;
}

/**
 * Point d'entrée du moteur : détecteurs automatiques + annuaire, chevauchements résolus.
 * Retourne des correspondances triées par position, sans chevauchement.
 */
export function analyze(text: string, options: AnalyzeOptions = {}): Match[] {
  const detectors = options.detectors ?? DETECTORS;
  const candidates = [
    ...collectCandidates(text, detectors),
    ...(options.directory ? findDirectoryMatches(text, options.directory) : []),
  ];
  return resolveOverlaps(candidates, text.length);
}
