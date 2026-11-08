// Normalisation pour comparer des textes sans tenir compte de la casse, des accents
// ni de la forme des espaces, tout en gardant la correspondance avec le texte d'origine
// (pour pouvoir masquer exactement la portion d'origine).

export interface NormalizedText {
  /** Texte normalisé. */
  text: string;
  /** Pour chaque unité UTF-16 du texte normalisé : début (inclus) dans le texte d'origine. */
  startOf: number[];
  /** Pour chaque unité UTF-16 du texte normalisé : fin (exclue) dans le texte d'origine. */
  endOf: number[];
}

const MARKS = /\p{M}/gu;
const WHITESPACE = /\s/u;

/** Voie lente (hors ASCII) : décompose, retire les accents, unifie apostrophes et tirets, met en minuscules. */
function foldNonAscii(char: string): string {
  return char
    .normalize('NFD')
    .replace(MARKS, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐-―−]/g, '-')
    .toLowerCase();
}

/**
 * Normalise un texte : minuscules, sans accents, apostrophes et tirets typographiques unifiés,
 * suites d'espaces (y compris insécables et retours à la ligne) réduites à une seule espace.
 * Retourne aussi, pour chaque unité du résultat, la portion correspondante du texte d'origine.
 */
export function normalizeWithMap(input: string): NormalizedText {
  const parts: string[] = [];
  const startOf: number[] = [];
  const endOf: number[] = [];
  let lastWasSpace = false;

  let i = 0;
  while (i < input.length) {
    const code = input.codePointAt(i) ?? 0;
    const end = i + (code > 0xffff ? 2 : 1);

    let folded: string;
    let isSpace = false;
    if (code < 128) {
      if (code === 32 || (code >= 9 && code <= 13)) {
        isSpace = true;
        folded = ' ';
      } else if (code >= 65 && code <= 90) {
        folded = String.fromCharCode(code + 32);
      } else {
        folded = String.fromCharCode(code);
      }
    } else {
      const char = input.slice(i, end);
      if (WHITESPACE.test(char)) {
        isSpace = true;
        folded = ' ';
      } else {
        folded = foldNonAscii(char);
      }
    }

    if (isSpace) {
      if (lastWasSpace) {
        endOf[endOf.length - 1] = end; // la suite d'espaces ne forme qu'une espace
      } else {
        parts.push(' ');
        startOf.push(i);
        endOf.push(end);
        lastWasSpace = true;
      }
    } else if (folded === '') {
      // Accent combinant isolé : rattaché au caractère précédent.
      if (endOf.length > 0) endOf[endOf.length - 1] = end;
    } else {
      for (let k = 0; k < folded.length; k++) {
        startOf.push(i);
        endOf.push(end);
      }
      parts.push(folded);
      lastWasSpace = false;
    }
    i = end;
  }

  return { text: parts.join(''), startOf, endOf };
}

/** Clé de comparaison d'un terme : texte normalisé, sans espaces en tête ni en queue. */
export function normalizeKey(input: string): string {
  return normalizeWithMap(input).text.trim();
}
