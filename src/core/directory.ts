import { normalizeKey, normalizeWithMap } from './normalize';
import { RANK_DIRECTORY, type Candidate } from './overlap';

// Annuaire des termes interdits : noms de clients, de personnes, de projets, de serveurs…
// Aucun accès DOM, réseau ni stockage : le moteur reste réutilisable tel quel dans l'extension (V2).

export const DEFAULT_CATEGORIES = ['CLIENT', 'PERSONNE', 'PROJET', 'SERVEUR', 'INTERNE'] as const;
/** Catégorie appliquée quand un import n'en précise pas. */
export const DEFAULT_CATEGORY = 'INTERNE';

export const MIN_TERM_LENGTH = 2;
export const MAX_TERM_LENGTH = 200;
export const MAX_ALIASES = 50;

export interface DirectoryEntry {
  /** Terme principal, tel que saisi (espaces réduits). */
  term: string;
  /** Catégorie normalisée (ex. CLIENT), utilisée pour les jetons [CLIENT_1]. */
  category: string;
  /** Variantes du terme (« Dupont S.A. » pour « Dupont SA »). */
  aliases: string[];
}

export type EntryResult = { ok: true; entry: DirectoryEntry } | { ok: false; error: string };

/** Catégorie en majuscules, sans accents, mots reliés par « _ » ; null si invalide. */
export function normalizeCategory(raw: string): string | null {
  const s = raw
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return /^[A-Z][A-Z0-9_]{0,31}$/.test(s) ? s : null;
}

function checkTerm(raw: string): { ok: true; clean: string; key: string } | { ok: false; error: string } {
  const clean = raw.replace(/\s+/g, ' ').trim();
  const key = normalizeKey(clean);
  if (key.length === 0) return { ok: false, error: 'Le terme est vide.' };
  if (key.length < MIN_TERM_LENGTH) {
    return { ok: false, error: `Terme trop court (${MIN_TERM_LENGTH} caractères minimum) : « ${clean} ».` };
  }
  if (clean.length > MAX_TERM_LENGTH) {
    return { ok: false, error: `Terme trop long (${MAX_TERM_LENGTH} caractères maximum).` };
  }
  return { ok: true, clean, key };
}

/** Valide et normalise une entrée d'annuaire. */
export function makeEntry(term: string, category: string, aliases: readonly string[] = []): EntryResult {
  const main = checkTerm(term);
  if (!main.ok) return main;

  const cat = normalizeCategory(category);
  if (cat === null) {
    return {
      ok: false,
      error: `Catégorie invalide : « ${category} » (lettres, chiffres et « _ », 32 caractères maximum, commence par une lettre).`,
    };
  }

  const cleanAliases: string[] = [];
  const seen = new Set<string>([main.key]);
  for (const raw of aliases) {
    if (raw.trim() === '') continue;
    if (raw.includes('|')) return { ok: false, error: `Un alias ne peut pas contenir « | » : « ${raw} ».` };
    const alias = checkTerm(raw);
    if (!alias.ok) return { ok: false, error: `Alias invalide : ${alias.error}` };
    if (seen.has(alias.key)) continue;
    seen.add(alias.key);
    cleanAliases.push(alias.clean);
  }
  if (cleanAliases.length > MAX_ALIASES) {
    return { ok: false, error: `Trop d'alias (${MAX_ALIASES} maximum).` };
  }

  return { ok: true, entry: { term: main.clean, category: cat, aliases: cleanAliases } };
}

export interface MergeResult {
  entries: DirectoryEntry[];
  added: number;
  /** Entrées ignorées car leur terme principal existe déjà (l'existant l'emporte). */
  skipped: number;
}

/** Ajoute des entrées à un annuaire existant, sans doublon de terme principal. */
export function mergeEntries(base: readonly DirectoryEntry[], incoming: readonly DirectoryEntry[]): MergeResult {
  const seen = new Set(base.map((e) => normalizeKey(e.term)));
  const entries = [...base];
  let added = 0;
  let skipped = 0;
  for (const entry of incoming) {
    const key = normalizeKey(entry.term);
    if (seen.has(key)) {
      skipped++;
    } else {
      seen.add(key);
      entries.push(entry);
      added++;
    }
  }
  return { entries, added, skipped };
}

// --- Compilation et recherche -------------------------------------------------

interface CompiledPattern {
  /** Terme ou alias, normalisé. */
  key: string;
  category: string;
  /** Ordre de déclaration : départage deux correspondances de même longueur. */
  order: number;
  /** Une frontière de mot n'est exigée que si le bord du terme est une lettre ou un chiffre. */
  needLeftBoundary: boolean;
  needRightBoundary: boolean;
}

export interface CompiledDirectory {
  patterns: CompiledPattern[];
  /** Clés déclarées dans plusieurs catégories (la première déclaration l'emporte). */
  conflicts: string[];
}

const WORD = /[\p{L}\p{N}]/u;

function isWordCodePoint(cp: number): boolean {
  if (cp < 128) return (cp >= 48 && cp <= 57) || (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122);
  return WORD.test(String.fromCodePoint(cp));
}

/** Le caractère qui précède la position `index` est-il une lettre ou un chiffre ? */
function wordBefore(text: string, index: number): boolean {
  if (index <= 0) return false;
  const unit = text.charCodeAt(index - 1);
  if (unit >= 0xdc00 && unit <= 0xdfff && index >= 2) {
    const high = text.charCodeAt(index - 2);
    if (high >= 0xd800 && high <= 0xdbff) return isWordCodePoint(text.codePointAt(index - 2) ?? 0);
  }
  return isWordCodePoint(unit);
}

/** Le caractère à la position `index` est-il une lettre ou un chiffre ? */
function wordAt(text: string, index: number): boolean {
  if (index >= text.length) return false;
  return isWordCodePoint(text.codePointAt(index) ?? 0);
}

/** Prépare l'annuaire pour la recherche : termes et alias normalisés, sans doublon. */
export function compileDirectory(entries: readonly DirectoryEntry[]): CompiledDirectory {
  const patterns: CompiledPattern[] = [];
  const categoryByKey = new Map<string, string>();
  const conflicts = new Set<string>();

  for (const entry of entries) {
    for (const raw of [entry.term, ...entry.aliases]) {
      const key = normalizeKey(raw);
      if (key.length < MIN_TERM_LENGTH) continue; // garde-fou : jamais de terme d'un seul caractère
      const known = categoryByKey.get(key);
      if (known !== undefined) {
        if (known !== entry.category) conflicts.add(key);
        continue;
      }
      categoryByKey.set(key, entry.category);
      const first = key.codePointAt(0) ?? 0;
      const last = [...key].at(-1)?.codePointAt(0) ?? 0;
      patterns.push({
        key,
        category: entry.category,
        order: patterns.length,
        needLeftBoundary: isWordCodePoint(first),
        needRightBoundary: isWordCodePoint(last),
      });
    }
  }
  return { patterns, conflicts: [...conflicts] };
}

/**
 * Cherche les termes de l'annuaire dans un texte. La valeur renvoyée est la portion
 * d'origine (casse et accents conservés). Les occurrences qui se chevauchent sont toutes
 * renvoyées : c'est `resolveOverlaps` qui tranche.
 */
export function findDirectoryMatches(text: string, directory: CompiledDirectory): Candidate[] {
  if (directory.patterns.length === 0 || text.length === 0) return [];
  const normalized = normalizeWithMap(text);
  const haystack = normalized.text;
  const out: Candidate[] = [];

  for (const pattern of directory.patterns) {
    let from = 0;
    for (;;) {
      const i = haystack.indexOf(pattern.key, from);
      if (i === -1) break;
      from = i + 1;
      const j = i + pattern.key.length;
      if (pattern.needLeftBoundary && wordBefore(haystack, i)) continue;
      if (pattern.needRightBoundary && wordAt(haystack, j)) continue;
      const start = normalized.startOf[i];
      const end = normalized.endOf[j - 1];
      if (start === undefined || end === undefined) continue;
      out.push({
        start,
        end,
        value: text.slice(start, end),
        category: pattern.category,
        rank: RANK_DIRECTORY,
        order: pattern.order,
      });
    }
  }
  return out;
}
