import { BRACKETED_SOURCE, tokenName } from './token-format';

// Restauration : remet les vraies valeurs à la place des jetons dans la réponse d'une IA.

export interface RestoreResult {
  /** Texte avec les valeurs d'origine. */
  text: string;
  /** Nombre de jetons remplacés. */
  restored: number;
  /** Jetons connus qui n'apparaissent pas dans la réponse (l'IA les a supprimés ou reformulés). */
  missing: string[];
  /** Jetons de la forme [CATEGORIE_N] absents de la table : inventés par l'IA, laissés tels quels. */
  unknown: string[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remplace les jetons d'un texte par leur valeur.
 * @param table nom de jeton sans crochets (« CLIENT_1 ») vers valeur d'origine.
 *
 * Variantes acceptées : minuscules, espaces dans les crochets, caractères échappés
 * (« [CLIENT\_1] », « \[CLIENT_1\] »). Un jeton sans crochets (« CLIENT_1 ») n'est remplacé
 * que s'il est écrit en majuscules et connu de la table. Les valeurs sont insérées telles
 * quelles : elles ne sont jamais relues comme jeton.
 */
export function restoreTokens(text: string, table: ReadonlyMap<string, string>): RestoreResult {
  const categories = new Set<string>();
  for (const name of table.keys()) {
    const cut = name.lastIndexOf('_');
    if (cut > 0) categories.add(name.slice(0, cut));
  }
  const hasBare = categories.size > 0;
  const bare = hasBare
    ? `|(?<![A-Za-z0-9_\\[\\\\])(${[...categories].map(escapeRegExp).join('|')})_(\\d{1,6})(?![A-Za-z0-9_])`
    : '';
  const pattern = new RegExp(BRACKETED_SOURCE + bare, 'gi');

  const found = new Set<string>();
  const unknown = new Set<string>();
  let restored = 0;

  const out = text.replace(pattern, (match: string, ...rest: unknown[]) => {
    const g = rest as (string | undefined)[];
    let name: string;
    let bracketed: boolean;
    if (g[0] !== undefined) {
      name = tokenName(g[0], g[1] ?? '0');
      bracketed = true;
    } else if (hasBare && g[2] !== undefined) {
      if (match !== match.toUpperCase()) return match; // « client_1 » en minuscules : probablement un identifiant
      name = tokenName(g[2], g[3] ?? '0');
      bracketed = false;
    } else {
      return match;
    }
    const value = table.get(name);
    if (value === undefined) {
      if (bracketed) unknown.add(name);
      return match;
    }
    found.add(name);
    restored++;
    return value;
  });

  return {
    text: out,
    restored,
    missing: [...table.keys()].filter((name) => !found.has(name)),
    unknown: [...unknown],
  };
}
