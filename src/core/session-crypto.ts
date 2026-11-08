// Chiffrement de la session pour un stockage local facultatif (« garder la session »).
// AES-GCM 256 bits ; clé dérivée de la phrase de passe par PBKDF2-SHA256 (WebCrypto).
// Rien n'est jamais envoyé nulle part : seule la forme chiffrée peut être stockée.

import type { SessionData } from './pseudonymize';

export const DEFAULT_ITERATIONS = 600_000;
export const MIN_ITERATIONS = 1_000;
export const MAX_ITERATIONS = 10_000_000;
export const MIN_PASSPHRASE_LENGTH = 8;

const ENVELOPE_VERSION = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const ADDITIONAL_DATA = new TextEncoder().encode('filtre-ia/session/v1');

export type EncryptResult = { ok: true; payload: string } | { ok: false; error: string };
export type DecryptResult = { ok: true; data: unknown } | { ok: false; error: string };

interface Envelope {
  v: number;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string;
  iv: string;
  ct: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Chiffre les données de session. Le résultat est un texte JSON sûr à stocker. */
export async function encryptSession(
  data: SessionData,
  passphrase: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<EncryptResult> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return { ok: false, error: `La phrase de passe doit faire au moins ${MIN_PASSPHRASE_LENGTH} caractères.` };
  }
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    return { ok: false, error: 'Nombre d\'itérations invalide.' };
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: ADDITIONAL_DATA }, key, plaintext),
  );
  const envelope: Envelope = {
    v: ENVELOPE_VERSION,
    kdf: 'PBKDF2-SHA256',
    iter: iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(ciphertext),
  };
  return { ok: true, payload: JSON.stringify(envelope) };
}

function parseEnvelope(payload: string): Envelope | null {
  try {
    const e = JSON.parse(payload) as Partial<Envelope> | null;
    if (typeof e !== 'object' || e === null) return null;
    if (e.v !== ENVELOPE_VERSION || e.kdf !== 'PBKDF2-SHA256') return null;
    if (typeof e.iter !== 'number' || !Number.isInteger(e.iter) || e.iter < MIN_ITERATIONS || e.iter > MAX_ITERATIONS) {
      return null;
    }
    if (typeof e.salt !== 'string' || typeof e.iv !== 'string' || typeof e.ct !== 'string') return null;
    return e as Envelope;
  } catch {
    return null;
  }
}

/** Déchiffre une session. Échoue (sans rien révéler) si la phrase de passe est fausse ou les données altérées. */
export async function decryptSession(payload: string, passphrase: string): Promise<DecryptResult> {
  const envelope = parseEnvelope(payload);
  if (!envelope) return { ok: false, error: 'Données de session illisibles.' };
  try {
    const salt = fromBase64(envelope.salt);
    const iv = fromBase64(envelope.iv);
    if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) return { ok: false, error: 'Données de session illisibles.' };
    const key = await deriveKey(passphrase, salt, envelope.iter);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: ADDITIONAL_DATA },
      key,
      fromBase64(envelope.ct),
    );
    return { ok: true, data: JSON.parse(new TextDecoder().decode(plaintext)) as unknown };
  } catch {
    return { ok: false, error: 'Phrase de passe incorrecte ou données altérées.' };
  }
}
