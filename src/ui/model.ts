// Modèle de l'application : toute la logique, sans aucun accès au DOM (testable en Node).

import { compileDirectory, makeEntry, mergeEntries, type DirectoryEntry } from '../core/directory';
import { exportCsv, exportJson, importCsv, importJson, type ImportResult } from '../core/directory-io';
import { createDetectors, DETECTORS } from '../core/detectors';
import { analyze } from '../core/engine';
import { normalizeKey } from '../core/normalize';
import { TokenSession, type CleanResult } from '../core/pseudonymize';
import type { RestoreResult } from '../core/restore';
import type { Match } from '../core/types';

export interface Settings {
  /** Surcharge activé/désactivé par identifiant de détecteur. */
  enabled: Record<string, boolean>;
  internalDomains: string[];
}

export const DEFAULT_SETTINGS: Settings = { enabled: {}, internalDomains: [] };

/** Clé d'identité d'une valeur : même clé = même jeton = masquée ou non ensemble. */
export function valueKey(m: Pick<Match, 'category' | 'value'>): string {
  return `${m.category}|${normalizeKey(m.value) || m.value}`;
}

export interface ReviewItem {
  match: Match;
  key: string;
  masked: boolean;
}

export type AddResult = { ok: true } | { ok: false; error: string };

export class AppModel {
  settings: Settings;
  /** Annuaire permanent (sauvegardé par l'interface si l'utilisateur le souhaite). */
  directory: DirectoryEntry[];
  /** Termes masqués manuellement pour cette visite seulement. */
  temporary: DirectoryEntry[] = [];
  /** Valeurs que l'utilisateur a choisi de ne pas masquer (faux positifs). */
  private ignored = new Set<string>();
  session = new TokenSession();
  /** Nom affiché dans les jetons, par catégorie interne (ex. TEL → PHONE en anglais). */
  categoryMap: Record<string, string> = {};

  /** Texte réellement analysé : c'est lui, et lui seul, qui est nettoyé. */
  analyzedText: string | null = null;
  matches: Match[] = [];
  lastClean: CleanResult | null = null;

  constructor(settings: Settings = DEFAULT_SETTINGS, directory: DirectoryEntry[] = []) {
    this.settings = { enabled: { ...settings.enabled }, internalDomains: [...settings.internalDomains] };
    this.directory = [...directory];
  }

  display(category: string): string {
    return this.categoryMap[category] ?? category;
  }

  // --- Détection -------------------------------------------------------------

  detectors() {
    return this.settings.internalDomains.length === 0 && Object.keys(this.settings.enabled).length === 0
      ? DETECTORS
      : createDetectors({ enabled: this.settings.enabled, internalDomains: this.settings.internalDomains });
  }

  analyze(text: string): ReviewItem[] {
    this.analyzedText = text;
    this.lastClean = null;
    this.matches = analyze(text, {
      detectors: this.detectors(),
      directory: compileDirectory([...this.directory, ...this.temporary]),
    });
    return this.review();
  }

  review(): ReviewItem[] {
    return this.matches.map((match) => {
      const key = valueKey(match);
      return { match, key, masked: !this.ignored.has(key) };
    });
  }

  /** Bascule masquer / ne pas masquer pour toutes les occurrences de la valeur. */
  toggleValue(key: string): void {
    if (this.ignored.has(key)) this.ignored.delete(key);
    else this.ignored.add(key);
    this.lastClean = null;
  }

  maskedCount(): number {
    return this.review().filter((r) => r.masked).length;
  }

  // --- Masquage manuel -------------------------------------------------------

  /** Masque toutes les occurrences d'un texte sélectionné (annuaire temporaire ou permanent). */
  addTerm(term: string, category: string, permanent: boolean, aliases: readonly string[] = []): AddResult {
    const made = makeEntry(term, category, aliases);
    if (!made.ok) return made;
    const target = permanent ? this.directory : this.temporary;
    const merged = mergeEntries([...this.directory, ...this.temporary], [made.entry]);
    if (merged.added === 0) return { ok: false, error: 'Ce terme est déjà dans l\'annuaire.' };
    target.push(made.entry);
    this.ignored.delete(valueKey({ category: made.entry.category, value: made.entry.term }));
    return { ok: true };
  }

  // --- Annuaire --------------------------------------------------------------

  removeEntry(index: number): void {
    this.directory.splice(index, 1);
  }

  importDirectory(text: string, fileName: string): ImportResult & { added: number; skipped: number } {
    const isCsv = /\.(csv|tsv|txt)$/i.test(fileName);
    const result = isCsv ? importCsv(text) : importJson(text);
    const merged = mergeEntries(this.directory, result.entries);
    this.directory = merged.entries;
    return { ...result, added: merged.added, skipped: merged.skipped };
  }

  exportDirectory(format: 'json' | 'csv'): string {
    return format === 'json' ? exportJson(this.directory) : exportCsv(this.directory);
  }

  // --- Nettoyage et restauration ----------------------------------------------

  /** Remplace les valeurs masquées de l'analyse par leurs jetons. */
  validate(): CleanResult | null {
    if (this.analyzedText === null) return null;
    const masked = this.review()
      .filter((r) => r.masked)
      .map((r) => ({ ...r.match, category: this.display(r.match.category) }));
    this.lastClean = this.session.clean(this.analyzedText, masked);
    return this.lastClean;
  }

  restore(reply: string): RestoreResult {
    return this.session.restore(reply);
  }

  newSession(): void {
    this.session.clear();
    this.lastClean = null;
  }
}
