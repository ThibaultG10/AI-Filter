import { describe, expect, it } from 'vitest';
import { createDetectors, detect } from '../src/core/detectors';
import type { Match } from '../src/core/types';

const detectors = createDetectors({ internalDomains: ['entreprise.local', 'corp.example.net'] });

const PEM = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----';

/** Texte contenant un exemple de chaque type de donnée sensible. */
const SENSITIVE_VALUES = [
  'jean.dupont@example.com',
  '06 12 34 56 78',
  '+44 7911 123456',
  '192.168.1.1',
  '2001:db8::1',
  'https://git.entreprise.local/x',
  'FR76 3000 6000 0112 3456 7890 189',
  '4111 1111 1111 1111',
  '73282932000017',
  '552 032 534',
  '2 69 05 49 588 157 80',
  'sk-abcdefghijklmnopqrstuvwxyz123456',
  'AKIAIOSFODNN7EXAMPLE',
  'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
  'xo' + 'xb-123456789012-abcdefghijklmnop',
  'eyJhbGciOi.eyJzdWIiOi.abcde12345',
];

const TEXTE_COMPLET = [
  `Contact : ${SENSITIVE_VALUES[0]} ou ${SENSITIVE_VALUES[1]} (${SENSITIVE_VALUES[2]}).`,
  `Serveur ${SENSITIVE_VALUES[3]} et ${SENSITIVE_VALUES[4]}, wiki ${SENSITIVE_VALUES[5]}.`,
  `IBAN ${SENSITIVE_VALUES[6]}, carte ${SENSITIVE_VALUES[7]}.`,
  `SIRET ${SENSITIVE_VALUES[8]}, SIREN ${SENSITIVE_VALUES[9]}, sécu ${SENSITIVE_VALUES[10]}.`,
  `Clés : ${SENSITIVE_VALUES[11]} ${SENSITIVE_VALUES[12]} ${SENSITIVE_VALUES[13]} ${SENSITIVE_VALUES[14]} ${SENSITIVE_VALUES[15]}`,
  PEM,
].join('\n');

function mask(text: string, matches: readonly Match[]): string {
  let out = '';
  let pos = 0;
  for (const m of matches) {
    out += text.slice(pos, m.start) + `[${m.category}]`;
    pos = m.end;
  }
  return out + text.slice(pos);
}

describe('texte contenant tous les types de données', () => {
  const matches = detect(TEXTE_COMPLET, detectors);

  it('détecte toutes les catégories attendues', () => {
    const categories = new Set(matches.map((m) => m.category));
    for (const expected of ['EMAIL', 'TEL', 'IP', 'URL_INTERNE', 'IBAN', 'CARTE', 'SIRET', 'SIREN', 'NIR', 'CLE_API']) {
      expect(categories, `catégorie manquante : ${expected}`).toContain(expected);
    }
  });

  it('masque entièrement toutes les valeurs sensibles', () => {
    const masked = mask(TEXTE_COMPLET, matches);
    for (const value of [...SENSITIVE_VALUES, PEM]) {
      expect(masked, `valeur non masquée : ${value}`).not.toContain(value);
    }
  });

  it('renvoie des correspondances cohérentes, triées et sans chevauchement', () => {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      expect(TEXTE_COMPLET.slice(m.start, m.end)).toBe(m.value);
      if (i > 0) expect(m.start).toBeGreaterThanOrEqual(matches[i - 1]!.end);
    }
  });
});

describe('chevauchements entre détecteurs', () => {
  it('un téléphone +33 n\'est signalé qu\'une fois', () => {
    expect(detect('Appelle le +33 6 12 34 56 78 vite')).toHaveLength(1);
  });

  it('un SIRET espacé n\'est pas coupé en SIREN + reste', () => {
    const out = detect('SIRET 732 829 320 00017', detectors);
    expect(out.map((m) => m.category)).toEqual(['SIRET']);
  });

  it('un e-mail avec domaine interne reste un seul e-mail', () => {
    const out = detect('jean@srv.entreprise.local', detectors);
    expect(out.map((m) => m.category)).toEqual(['EMAIL']);
  });

  it('un NIR n\'est pas pris pour une carte bancaire', () => {
    const out = detect('2 69 05 49 588 157 80', detectors);
    expect(out.map((m) => m.category)).toEqual(['NIR']);
  });
});

// --- Robustesse : entrées adverses de 50 000 caractères -----------------------

const SIZE = 50_000;
const ADVERSARIAL: ReadonlyArray<readonly [string, string]> = [
  ['lettres seules', 'a'.repeat(SIZE)],
  ['chiffres seuls', '1'.repeat(SIZE)],
  ['zéros', '0'.repeat(SIZE)],
  ['chiffres espacés', '1 '.repeat(SIZE / 2)],
  ['espaces', ' '.repeat(SIZE)],
  ['deux-points', ':'.repeat(SIZE)],
  ['lettre + deux-points', 'a:'.repeat(SIZE / 2)],
  ['arobases', 'a@'.repeat(SIZE / 2)],
  ['points', 'a.'.repeat(SIZE / 2)],
  ['octets IPv4', '1.'.repeat(SIZE / 2)],
  ['plus-un', '+1'.repeat(SIZE / 2)],
  ['en-têtes PEM sans fin', '-----BEGIN PRIVATE KEY-----'.repeat(1800)],
  ['préfixes sk-', 'sk-'.repeat(16_000)],
  ['groupes IBAN', 'AB12 '.repeat(10_000)],
  ['préfixes Slack', ('xo' + 'xb-').repeat(10_000)],
  ['JWT sans point', 'eyJ' + 'a'.repeat(SIZE)],
  ['JWT répétés', 'eyJaaaaa.'.repeat(5_500)],
  ['tirets', '-'.repeat(SIZE)],
  ['SIREN répétés', '732 829 320 '.repeat(4_000)],
  ['numéros FR répétés', '06 12 34 56 78 '.repeat(3_300)],
  ['SSN répétés', '123-45-6789 '.repeat(4_200)],
  ['tirets et chiffres', '123-'.repeat(12_500)],
  ['parenthèses', '('.repeat(SIZE)],
  ['indicatifs US', '(415) 555-'.repeat(5_000)],
  ['numéros US répétés', '415-555-2671 '.repeat(3_800)],
  ['NINO répétés', 'AB 12 34 56 C '.repeat(3_500)],
  ['paires de lettres', 'AB'.repeat(SIZE / 2)],
  ['lettres et chiffres', 'AB 12 '.repeat(8_300)],
  ['numéros UK répétés', '07911 123456 '.repeat(3_800)],
  ['zéros UK espacés', '0 '.repeat(SIZE / 2)],
  ['préfixes UK', '020 '.repeat(12_500)],
];

describe('robustesse (pas de ReDoS) sur 50 000 caractères', () => {
  it.each(ADVERSARIAL)('%s : moins de 300 ms', (_name, input) => {
    const start = performance.now();
    detect(input, detectors);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(300);
  });
});

describe('performance sur un texte réaliste de 50 000 caractères', () => {
  it('se traite en moins de 300 ms', () => {
    const paragraph =
      'Bonjour, voici le point sur le dossier. Merci de contacter jean.dupont@example.com ou le 06 12 34 56 78. ' +
      'Le serveur 192.168.1.1 héberge https://git.entreprise.local/projet. Facture réglée par virement sur ' +
      'FR76 3000 6000 0112 3456 7890 189, carte 4111 1111 1111 1111. Lorem ipsum dolor sit amet, consectetur ' +
      'adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';
    const text = paragraph.repeat(Math.ceil(SIZE / paragraph.length)).slice(0, SIZE);
    const start = performance.now();
    const matches = detect(text, detectors);
    const elapsed = performance.now() - start;
    expect(matches.length).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(300);
  });
});
