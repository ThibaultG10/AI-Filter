import { makeEntry, type DirectoryEntry } from '../../src/core/directory';

// Générateur déterministe de textes variés pour les tests d'aller-retour et de fuite.
// Chaque valeur est toujours écrite avec la même graphie : le jeton d'une valeur restitue
// alors exactement le texte d'origine.

export interface CorpusItem {
  text: string;
  /** Valeurs sensibles présentes dans le texte (aucune ne doit survivre au nettoyage). */
  sensitive: string[];
}

const PERSONS = ['Élodie Martin', 'Jean-Paul Durand', 'Amélie Poulain', 'Mohamed Benali', 'Zoé Lefèvre', 'Nguyen Van An'];
const CLIENTS = ['Dupont SA', 'Société Générale Lyon', 'Boulangerie Moreau', 'Airbus Défense'];
const PROJECTS = ['Projet Phénix', 'Opération Colibri'];
const SERVERS = ['srv-prod-01', 'srv-db-lyon'];
const EMAILS = ['jean.dupont@example.com', 'm.benali@societe-test.fr', 'contact@boulangerie-moreau.fr', 'zoe.lefevre@mail.example.org'];
const PHONES = ['06 12 34 56 78', '+33 6 98 76 54 32', '01.23.45.67.89', '0033 7 11 22 33 44'];
const IPS = ['192.168.1.14', '10.20.30.40', '203.0.113.7'];
const IBANS = ['FR76 3000 6000 0112 3456 7890 189', 'DE89 3704 0044 0532 0130 00', 'GB82 WEST 1234 5698 7654 32'];
const CARDS = ['4111 1111 1111 1111', '5555 5555 5555 4444'];
const NIRS = ['2 69 05 49 588 157 80', '1 85 05 78 006 084 91'];
const SIRETS = ['73282932000017', '443 061 841 00021'];
const KEYS = ['sk-abcdefghijklmnopqrstuvwxyz123456', 'AKIAIOSFODNN7EXAMPLE', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'];

const FILLERS = [
  'Bonjour,',
  'Pouvez-vous résumer ce dossier ?',
  'Merci d’avance.',
  'Voici le contexte :',
  'Ligne 1\nLigne 2',
  '**Important** : relire avant envoi',
  '`code inline`',
  'Réf. dossier n° 2024/17 (interne)',
  '— fin du message —',
  'Résumé en 3 points svp.',
  'Coût estimé : 1 250 € HT',
  'RDV le 12/03/2025 à 14h30',
  '日本語のテキスト',
  'Café crème, naïve façade, Œuvre',
];

/** Textes déjà au format jeton : ils ne doivent jamais être confondus avec de vrais jetons. */
const TOKEN_LOOKALIKES = ['[CLIENT_1]', 'EMAIL_2', '[ email_1 ]', '[PERSONNE_3]', 'IP_1'];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function corpusDirectory(): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  const add = (terms: string[], category: string): void => {
    for (const term of terms) {
      const r = makeEntry(term, category);
      if (!r.ok) throw new Error(r.error);
      entries.push(r.entry);
    }
  };
  add(PERSONS, 'PERSONNE');
  add(CLIENTS, 'CLIENT');
  add(PROJECTS, 'PROJET');
  add(SERVERS, 'SERVEUR');
  return entries;
}

export function buildCorpus(count = 100, seed = 42, withLookalikes = true): CorpusItem[] {
  const rand = mulberry32(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;

  const items: CorpusItem[] = [];
  for (let i = 0; i < count; i++) {
    const sensitive: string[] = [];
    const use = (value: string): string => {
      sensitive.push(value);
      return value;
    };
    const makers: Array<() => string> = [
      () => pick(FILLERS),
      () => pick(FILLERS),
      () => `Contact : ${use(pick(EMAILS))}`,
      () => `Tel ${use(pick(PHONES))}`,
      () => `Serveur ${use(pick(IPS))} (${use(pick(SERVERS))})`,
      () => `Facturer ${use(pick(CLIENTS))}, IBAN ${use(pick(IBANS))}`,
      () => `Carte ${use(pick(CARDS))} au nom de ${use(pick(PERSONS))}`,
      () => `Sécu ${use(pick(NIRS))}`,
      () => `SIRET ${use(pick(SIRETS))}`,
      () => `Clé : ${use(pick(KEYS))}`,
      () => `${use(pick(PROJECTS))} suivi par ${use(pick(PERSONS))} chez ${use(pick(CLIENTS))}`,
      () => (withLookalikes ? pick(TOKEN_LOOKALIKES) : pick(FILLERS)),
    ];
    const parts: string[] = [];
    const length = 3 + Math.floor(rand() * 6);
    for (let k = 0; k < length; k++) parts.push(pick(makers)());
    const separators = [' ', '\n', '\n\n', ' — '];
    let text = parts[0] ?? '';
    for (let k = 1; k < parts.length; k++) text += pick(separators) + parts[k];
    items.push({ text, sensitive });
  }
  return items;
}
