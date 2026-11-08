import { RANK_DETECTOR, resolveOverlaps, type Candidate } from './overlap';
import type { Detector, Match } from './types';
import {
  isPlausibleInternationalPhone,
  isValidCard,
  isValidIban,
  isValidIPv4,
  isValidIPv6,
  isValidNir,
  isValidSiren,
  isValidSiret,
} from './validators';

// Règles de robustesse pour toutes les regex de ce fichier :
// - pas de quantificateur imbriqué ambigu ;
// - lookbehind en tête pour ne tenter un départ qu'au début d'une séquence
//   (évite un coût quadratique sur les longues séquences) ;
// - quantificateurs bornés dès qu'une borne existe.

export interface DetectorConfig {
  /** Surcharge de l'état activé/désactivé, par identifiant de détecteur. */
  enabled?: Readonly<Record<string, boolean>>;
  /** Domaines internes à masquer (ex. « entreprise.local », « *.corp.example.net »). */
  internalDomains?: readonly string[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Garde les domaines valides, en minuscules, sans « *. » ni point initial. */
function normalizeDomains(domains: readonly string[]): string[] {
  return domains
    .map((d) => d.trim().toLowerCase().replace(/^\*?\.+/, ''))
    .filter((d) => d.length > 0 && /^[a-z0-9.-]+$/.test(d));
}

function internalUrlPattern(domains: readonly string[]): RegExp {
  if (domains.length === 0) return /(?!)/g; // ne correspond jamais
  const alternatives = domains.map(escapeRegExp).join('|');
  return new RegExp(
    '(?<![A-Za-z0-9.-])' + // départ au début d'un nom d'hôte
      '(?:https?:\\/\\/)?' +
      '(?:[A-Za-z0-9-]+\\.)*' +
      `(?:${alternatives})` +
      '(?![A-Za-z0-9-])' +
      '(?::\\d{1,5})?' +
      // Chemin : ne se termine pas par une ponctuation de fin de phrase.
      '(?:\\/(?:[^\\s"\'<>)\\]]*[^\\s"\'<>)\\].,;:!?])?)?',
    'gi',
  );
}

function baseDetectors(internalDomains: readonly string[]): Detector[] {
  return [
    // Secrets d'abord : à longueur égale, ils passent avant les motifs génériques.
    {
      id: 'pem',
      label: 'Clés privées (PEM)',
      category: 'CLE_API',
      // Bloc complet si la fin est présente (borné à 8 192 caractères), sinon l'en-tête seul.
      pattern: /-----BEGIN [A-Z ]{0,30}PRIVATE KEY-----(?:[\s\S]{0,8192}?-----END [A-Z ]{0,30}PRIVATE KEY-----)?/g,
      enabled: true,
    },
    {
      id: 'jwt',
      label: 'Jetons JWT',
      category: 'CLE_API',
      pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}(?![A-Za-z0-9_-])/g,
      enabled: true,
    },
    {
      id: 'api-key-sk',
      label: 'Clés API (préfixe sk-)',
      category: 'CLE_API',
      pattern: /\bsk-[A-Za-z0-9_-]{16,}(?![A-Za-z0-9_-])/g,
      enabled: true,
    },
    {
      id: 'api-key-aws',
      label: 'Clés d\'accès AWS',
      category: 'CLE_API',
      pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
      enabled: true,
    },
    {
      id: 'api-key-github',
      label: 'Jetons GitHub',
      category: 'CLE_API',
      pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
      enabled: true,
    },
    {
      id: 'api-key-slack',
      label: 'Jetons Slack',
      category: 'CLE_API',
      pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
      enabled: true,
    },
    {
      id: 'email',
      label: 'E-mails',
      category: 'EMAIL',
      pattern: /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g,
      enabled: true,
    },
    {
      id: 'iban',
      label: 'IBAN',
      category: 'IBAN',
      pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g,
      validate: isValidIban,
      enabled: true,
    },
    {
      id: 'nir',
      label: 'N° de sécurité sociale',
      category: 'NIR',
      pattern: /(?<!\d)[12] ?\d{2} ?(?:0[1-9]|1[0-2]|[2-9]\d) ?(?:\d{2}|2[ABab]) ?\d{3} ?\d{3} ?\d{2}(?!\d)/g,
      validate: isValidNir,
      enabled: true,
    },
    {
      id: 'siret',
      label: 'SIRET',
      category: 'SIRET',
      pattern: /(?<!\d)\d{3} ?\d{3} ?\d{3} ?\d{5}(?!\d)/g,
      validate: isValidSiret,
      enabled: true,
    },
    {
      id: 'siren',
      label: 'SIREN',
      category: 'SIREN',
      pattern: /(?<!\d)\d{3} ?\d{3} ?\d{3}(?! ?\d)/g,
      validate: isValidSiren,
      enabled: true,
    },
    {
      id: 'card',
      label: 'Cartes bancaires',
      category: 'CARTE',
      pattern: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g,
      validate: isValidCard,
      enabled: true,
    },
    {
      id: 'phone-fr',
      label: 'Téléphones français',
      category: 'TEL',
      pattern: /(?<![\d+])(?:(?:\+33|0033)[ .-]?(?:\(0\))?[1-9]|0[1-9])(?:[ .-]?\d{2}){4}(?!\d)/g,
      enabled: true,
    },
    {
      id: 'phone-intl',
      label: 'Téléphones internationaux',
      category: 'TEL',
      pattern: /(?<![\w+])\+[1-9](?:[ .\-()]{0,2}\d){7,14}(?!\d)/g,
      validate: isPlausibleInternationalPhone,
      enabled: true,
    },
    {
      id: 'ipv4',
      label: 'Adresses IPv4',
      category: 'IP',
      pattern: /(?<!\d)(?<!\d\.)(?:\d{1,3}\.){3}\d{1,3}(?!\d|\.\d)/g,
      validate: isValidIPv4,
      enabled: true,
    },
    {
      id: 'ipv6',
      label: 'Adresses IPv6',
      category: 'IP',
      pattern: /(?<![\w:.])[0-9A-Fa-f:]{2,39}(?![\w:]|\.\d)/g,
      validate: isValidIPv6,
      enabled: true,
    },
    {
      id: 'internal-url',
      label: 'URL et hôtes internes',
      category: 'URL_INTERNE',
      pattern: internalUrlPattern(internalDomains),
      enabled: internalDomains.length > 0,
    },
  ];
}

/** Construit la liste des détecteurs, dans l'ordre de priorité des départages. */
export function createDetectors(config: DetectorConfig = {}): Detector[] {
  const domains = normalizeDomains(config.internalDomains ?? []);
  return baseDetectors(domains).map((d) => ({ ...d, enabled: config.enabled?.[d.id] ?? d.enabled }));
}

/** Détecteurs par défaut (sans domaines internes : « internal-url » désactivé). */
export const DETECTORS: Detector[] = createDetectors();

/** Correspondances brutes de chaque détecteur actif, validées, avant résolution des chevauchements. */
export function collectCandidates(text: string, detectors: readonly Detector[]): Candidate[] {
  const candidates: Candidate[] = [];
  detectors.forEach((detector, order) => {
    if (!detector.enabled) return;
    const flags = detector.pattern.flags.includes('g') ? detector.pattern.flags : detector.pattern.flags + 'g';
    const pattern = new RegExp(detector.pattern.source, flags); // copie : aucun état partagé (lastIndex)
    for (const m of text.matchAll(pattern)) {
      const value = m[0];
      if (value.length === 0) continue;
      if (detector.validate && !detector.validate(value)) continue;
      const start = m.index ?? 0;
      candidates.push({
        start,
        end: start + value.length,
        value,
        category: detector.category,
        rank: RANK_DETECTOR,
        order,
      });
    }
  });
  return candidates;
}

/** Détecte les données sensibles : correspondances triées, sans chevauchement. */
export function detect(text: string, detectors: readonly Detector[] = DETECTORS): Match[] {
  return resolveOverlaps(collectCandidates(text, detectors), text.length);
}
