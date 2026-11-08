// Format des jetons [CATEGORIE_N] et lecture tolérante des jetons dans une réponse d'IA.
//
// Une IA peut modifier légèrement un jeton : minuscules, espaces dans les crochets,
// caractères échappés par un rendu Markdown (« [CLIENT\_1] », « \[CLIENT_1\] »).
// La lecture accepte ces variantes ; l'écriture, elle, produit toujours « [CATEGORIE_N] ».

/** Numéro maximal d'un jeton (6 chiffres). */
export const MAX_TOKEN_NUMBER = 999_999;

/** Jeton tel qu'écrit dans le texte nettoyé : « [CLIENT_1] ». */
export const tokenOf = (name: string): string => `[${name}]`;

/** Nom canonique d'un jeton, sans crochets : « CLIENT_1 ». */
export function tokenName(category: string, number: number | string): string {
  return `${category.replace(/\\/g, '').toUpperCase()}_${Number(number)}`;
}

/**
 * Source de la regex d'un jeton entre crochets (à compiler avec les options « gi »).
 * Groupe 1 : catégorie. Groupe 2 : numéro.
 * Tous les quantificateurs sont bornés : pas de retour sur trace excessif.
 */
export const BRACKETED_SOURCE = String.raw`\\?\[[ \t]{0,3}([A-Za-z](?:[A-Za-z0-9]|\\?_){0,31}?)\\?_(\d{1,6})[ \t]{0,3}\\?\]`;

/** Jeton sans crochets, en majuscules (« CLIENT_1 »), non collé à d'autres caractères. */
const BARE_SCAN = /(?<![A-Za-z0-9_[\\])([A-Z][A-Z0-9_]{0,31}?)_(\d{1,6})(?![A-Za-z0-9_])/g;

/**
 * Noms de tous les objets qui ressemblent à un jeton dans un texte (avec ou sans crochets).
 * Sert à ne jamais attribuer un jeton qui existe déjà tel quel dans le texte d'origine.
 */
export function scanTokenNames(text: string): Set<string> {
  const names = new Set<string>();
  for (const m of text.matchAll(new RegExp(BRACKETED_SOURCE, 'gi'))) {
    names.add(tokenName(m[1] ?? '', m[2] ?? '0'));
  }
  for (const m of text.matchAll(BARE_SCAN)) {
    names.add(tokenName(m[1] ?? '', m[2] ?? '0'));
  }
  return names;
}
