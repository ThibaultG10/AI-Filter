// Types partagés par le moteur. Aucune dépendance au DOM : ce module doit
// pouvoir tourner tel quel dans une extension de navigateur (V2).

/** Une portion de texte identifiée comme sensible. */
export interface Match {
  /** Index de début (inclus) dans le texte d'origine. */
  start: number;
  /** Index de fin (exclu). */
  end: number;
  /** Valeur d'origine. */
  value: string;
  /** Catégorie, utilisée pour fabriquer le jeton (ex. EMAIL, CLIENT). */
  category: string;
}

/** Définition d'un détecteur automatique. */
export interface Detector {
  id: string;
  label: string;
  /** Catégorie des jetons produits (ex. EMAIL, TEL, CLE_API). */
  category: string;
  /** Regex globale (flag g obligatoire). */
  pattern: RegExp;
  /** Validation optionnelle pour réduire les faux positifs (Luhn, mod 97…). */
  validate?: (value: string) => boolean;
  enabled: boolean;
}
