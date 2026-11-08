// Validateurs purs : aucune dépendance, aucun accès DOM, aucun réseau.
// Ils servent à écarter les faux positifs des détecteurs par motifs
// (un nombre de 16 chiffres n'est pas forcément une carte bancaire).

/** Algorithme de Luhn sur une chaîne composée uniquement de chiffres. */
export function luhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Longueur plausible selon le réseau, déduit du préfixe (IIN). */
function cardLengthMatchesBrand(d: string): boolean {
  const n = d.length;
  if (/^4/.test(d)) return n === 13 || n === 16 || n === 19; // Visa
  if (/^(?:5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(d)) return n === 16; // Mastercard
  if (/^3[47]/.test(d)) return n === 15; // American Express
  if (/^3(?:0[0-5]|[68])/.test(d)) return n >= 14 && n <= 19; // Diners
  if (/^35(?:2[89]|[3-8]\d)/.test(d)) return n >= 16 && n <= 19; // JCB
  if (/^6(?:011|2|4[4-9]|5)/.test(d)) return n >= 16 && n <= 19; // Discover, UnionPay
  return false;
}

/** Carte bancaire : 13 à 19 chiffres, préfixe de réseau connu, clé de Luhn valide. */
export function isValidCard(value: string): boolean {
  const d = value.replace(/[ -]/g, '');
  if (!/^\d{13,19}$/.test(d)) return false;
  return cardLengthMatchesBrand(d) && luhn(d);
}

/** Longueurs IBAN connues (autres pays : seule la plage 15-34 et le modulo 97 s'appliquent). */
const IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AT: 20,
  BE: 16,
  CH: 21,
  DE: 22,
  ES: 24,
  FR: 27,
  GB: 22,
  IE: 22,
  IT: 27,
  LU: 20,
  NL: 18,
  PT: 25,
};

/** IBAN : structure, longueur par pays connu, clé modulo 97 (ISO 13616). */
export function isValidIban(value: string): boolean {
  const s = value.replace(/ /g, '');
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const expected = IBAN_LENGTHS[s.slice(0, 2)];
  if (expected !== undefined && s.length !== expected) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    // Les lettres valent 10 à 35 (deux chiffres), les chiffres un seul.
    rem = code >= 65 ? (rem * 100 + (code - 55)) % 97 : (rem * 10 + (code - 48)) % 97;
  }
  return rem === 1;
}

/**
 * N° de sécurité sociale (NIR) : 13 chiffres + clé de 2 chiffres.
 * Corse : 2A et 2B valent respectivement 19 et 18 pour le calcul de la clé.
 * Clé = 97 - (NIR mod 97).
 */
export function isValidNir(value: string): boolean {
  const s = value.replace(/ /g, '').toUpperCase();
  const m = /^([12]\d{4})(\d{2}|2A|2B)(\d{6})(\d{2})$/.exec(s);
  if (!m) return false;
  const head = m[1];
  const dept = m[2];
  const rest = m[3];
  const key = m[4];
  if (head === undefined || dept === undefined || rest === undefined || key === undefined) return false;
  const deptDigits = dept === '2A' ? '19' : dept === '2B' ? '18' : dept;
  const base = Number(head + deptDigits + rest); // 13 chiffres < 2^53 : calcul exact
  return 97 - (base % 97) === Number(key);
}

/** SIREN : 9 chiffres, clé de Luhn. */
export function isValidSiren(value: string): boolean {
  const d = value.replace(/ /g, '');
  return /^\d{9}$/.test(d) && luhn(d);
}

/**
 * SIRET : 14 chiffres, clé de Luhn.
 * Exception historique de La Poste (SIREN 356000000) : somme des chiffres multiple de 5.
 */
export function isValidSiret(value: string): boolean {
  const d = value.replace(/ /g, '');
  if (!/^\d{14}$/.test(d)) return false;
  if (d.startsWith('356000000')) {
    let sum = 0;
    for (let i = 0; i < d.length; i++) sum += d.charCodeAt(i) - 48;
    if (sum % 5 === 0) return true;
  }
  return luhn(d);
}

/** IPv4 : 4 octets de 0 à 255, sans zéro non significatif. */
export function isValidIPv4(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((p) => /^(?:0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255);
}

/** IPv6 : groupes de 1 à 4 chiffres hexadécimaux, au plus un « :: ». */
export function isValidIPv6(value: string): boolean {
  if (!/^[0-9A-Fa-f:]+$/.test(value)) return false;
  const halves = value.split('::');
  if (halves.length > 2) return false;
  const groups = (part: string | undefined): string[] => (part === undefined || part === '' ? [] : part.split(':'));
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const all = [...head, ...tail];
  if (all.length === 0) return false;
  if (!all.every((g) => /^[0-9A-Fa-f]{1,4}$/.test(g))) return false;
  return halves.length === 2 ? all.length <= 7 : all.length === 8;
}

/** Numéro international (E.164) : 8 à 15 chiffres au total. */
export function isPlausibleInternationalPhone(value: string): boolean {
  const n = value.replace(/\D/g, '').length;
  return n >= 8 && n <= 15;
}
