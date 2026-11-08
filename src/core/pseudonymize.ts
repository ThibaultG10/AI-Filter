import { normalizeCategory } from './directory';
import { normalizeKey } from './normalize';
import { restoreTokens, type RestoreResult } from './restore';
import { MAX_TOKEN_NUMBER, scanTokenNames, tokenOf } from './token-format';
import type { Match } from './types';

// Pseudonymisation réversible : chaque valeur distincte reçoit un jeton stable par catégorie
// ([CLIENT_1], [EMAIL_2]…). La table de correspondance vit dans une session, en mémoire.

export interface Replacement {
  /** Jeton écrit dans le texte nettoyé, avec crochets. */
  token: string;
  category: string;
  /** Valeur d'origine. */
  value: string;
  /** Position dans le texte d'origine. */
  start: number;
  end: number;
}

export interface CleanResult {
  /** Texte nettoyé : les valeurs sensibles sont remplacées par des jetons. */
  text: string;
  replacements: Replacement[];
}

export interface SessionEntry {
  /** Jeton avec crochets, ex. « [CLIENT_1] ». */
  token: string;
  category: string;
  value: string;
}

/** Forme sérialisable d'une session (à chiffrer avant de la stocker). */
export interface SessionData {
  version: 1;
  entries: SessionEntry[];
}

export type SessionLoadResult = { ok: true; session: TokenSession } | { ok: false; error: string };

const TOKEN_FORMAT = /^\[([A-Z][A-Z0-9_]{0,31})_(\d{1,6})\]$/;
const MAX_SESSION_ENTRIES = 100_000;

interface Record_ {
  category: string;
  value: string;
}

export class TokenSession {
  /** nom du jeton (« CLIENT_1 ») → catégorie et valeur d'origine (première graphie rencontrée). */
  private readonly byName = new Map<string, Record_>();
  /** « CATEGORIE|valeur normalisée » → nom du jeton. */
  private readonly byKey = new Map<string, string>();
  private readonly maxNumber = new Map<string, number>();

  /** Nombre de jetons dans la session. */
  get size(): number {
    return this.byName.size;
  }

  private nameFor(category: string, value: string, reserved: ReadonlySet<string>): string {
    const key = `${category}|${normalizeKey(value) || value}`;
    const known = this.byKey.get(key);
    if (known !== undefined) return known;

    let n = this.maxNumber.get(category) ?? 0;
    let name: string;
    do {
      n++;
      name = `${category}_${n}`;
    } while (reserved.has(name) || this.byName.has(name));
    if (n > MAX_TOKEN_NUMBER) throw new RangeError(`Trop de jetons dans la catégorie ${category}.`);

    this.maxNumber.set(category, n);
    this.byName.set(name, { category, value });
    this.byKey.set(key, name);
    return name;
  }

  /**
   * Remplace chaque correspondance par son jeton. Une même valeur (sans tenir compte de la casse,
   * des accents ni de la forme des espaces) reçoit toujours le même jeton dans la session.
   * Les numéros de jeton qui existent déjà tels quels dans le texte sont évités.
   * Les correspondances invalides ou qui se chevauchent sont ignorées.
   */
  clean(text: string, matches: readonly Match[]): CleanResult {
    const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
    const reserved = scanTokenNames(text);
    const replacements: Replacement[] = [];
    let out = '';
    let position = 0;
    for (const m of sorted) {
      if (m.start < position || m.end <= m.start || m.end > text.length) continue;
      const category = normalizeCategory(m.category) ?? 'INTERNE';
      const value = text.slice(m.start, m.end);
      const token = tokenOf(this.nameFor(category, value, reserved));
      out += text.slice(position, m.start) + token;
      replacements.push({ token, category, value, start: m.start, end: m.end });
      position = m.end;
    }
    return { text: out + text.slice(position), replacements };
  }

  /** Remet les valeurs d'origine dans la réponse d'une IA. */
  restore(text: string): RestoreResult {
    const table = new Map<string, string>();
    for (const [name, record] of this.byName) table.set(name, record.value);
    return restoreTokens(text, table);
  }

  /** Contenu de la session, dans l'ordre de création. */
  entries(): SessionEntry[] {
    return [...this.byName].map(([name, r]) => ({ token: tokenOf(name), category: r.category, value: r.value }));
  }

  clear(): void {
    this.byName.clear();
    this.byKey.clear();
    this.maxNumber.clear();
  }

  toData(): SessionData {
    return { version: 1, entries: this.entries() };
  }

  /** Reconstruit une session à partir de données déchiffrées, en les validant. */
  static fromData(data: unknown): SessionLoadResult {
    if (typeof data !== 'object' || data === null) return { ok: false, error: 'Session illisible.' };
    const { version, entries } = data as { version?: unknown; entries?: unknown };
    if (version !== 1) return { ok: false, error: 'Version de session non prise en charge.' };
    if (!Array.isArray(entries) || entries.length > MAX_SESSION_ENTRIES) {
      return { ok: false, error: 'Session illisible : liste d\'entrées invalide.' };
    }

    const session = new TokenSession();
    for (const item of entries as unknown[]) {
      if (typeof item !== 'object' || item === null) return { ok: false, error: 'Session illisible : entrée invalide.' };
      const { token, category, value } = item as { token?: unknown; category?: unknown; value?: unknown };
      if (typeof token !== 'string' || typeof category !== 'string' || typeof value !== 'string' || value === '') {
        return { ok: false, error: 'Session illisible : entrée incomplète.' };
      }
      const m = TOKEN_FORMAT.exec(token);
      if (!m || m[1] === undefined || m[2] === undefined || m[1] !== category) {
        return { ok: false, error: `Session illisible : jeton invalide ${token}.` };
      }
      const name = `${m[1]}_${Number(m[2])}`;
      if (session.byName.has(name)) return { ok: false, error: `Session illisible : jeton en double ${token}.` };
      session.byName.set(name, { category, value });
      session.byKey.set(`${category}|${normalizeKey(value) || value}`, name);
      session.maxNumber.set(category, Math.max(session.maxNumber.get(category) ?? 0, Number(m[2])));
    }
    return { ok: true, session };
  }
}
