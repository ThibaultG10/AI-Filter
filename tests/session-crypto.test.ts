import { describe, expect, it } from 'vitest';
import { TokenSession } from '../src/core/pseudonymize';
import { decryptSession, encryptSession, MIN_PASSPHRASE_LENGTH } from '../src/core/session-crypto';

const ITERATIONS = 1_000; // rapide pour les tests ; la valeur par défaut est 600 000

function sampleSession(): TokenSession {
  const s = new TokenSession();
  const text = 'Dupont SA : jean@example.com';
  s.clean(text, [
    { start: 0, end: 9, value: 'Dupont SA', category: 'CLIENT' },
    { start: 12, end: 28, value: 'jean@example.com', category: 'EMAIL' },
  ]);
  return s;
}

describe('session chiffrée', () => {
  it('fait l\'aller-retour avec la bonne phrase de passe', async () => {
    const enc = await encryptSession(sampleSession().toData(), 'une phrase de passe', ITERATIONS);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = await decryptSession(enc.payload, 'une phrase de passe');
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    const loaded = TokenSession.fromData(dec.data);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.session.entries()).toEqual(sampleSession().entries());
  });

  it('ne contient aucune donnée en clair', async () => {
    const enc = await encryptSession(sampleSession().toData(), 'une phrase de passe', ITERATIONS);
    if (!enc.ok) throw new Error(enc.error);
    expect(enc.payload).not.toContain('Dupont');
    expect(enc.payload).not.toContain('jean@example.com');
    expect(enc.payload).not.toContain('CLIENT');
  });

  it('refuse une mauvaise phrase de passe', async () => {
    const enc = await encryptSession(sampleSession().toData(), 'une phrase de passe', ITERATIONS);
    if (!enc.ok) throw new Error(enc.error);
    const dec = await decryptSession(enc.payload, 'une autre phrase');
    expect(dec).toEqual({ ok: false, error: 'Phrase de passe incorrecte ou données altérées.' });
  });

  it('refuse des données altérées', async () => {
    const enc = await encryptSession(sampleSession().toData(), 'une phrase de passe', ITERATIONS);
    if (!enc.ok) throw new Error(enc.error);
    const envelope = JSON.parse(enc.payload) as { ct: string };
    const bytes = atob(envelope.ct).split('');
    bytes[0] = String.fromCharCode(bytes[0]!.charCodeAt(0) ^ 1); // un seul bit modifié
    envelope.ct = btoa(bytes.join(''));
    const dec = await decryptSession(JSON.stringify(envelope), 'une phrase de passe');
    expect(dec.ok).toBe(false);
  });

  it('produit un résultat différent à chaque chiffrement (sel et vecteur aléatoires)', async () => {
    const a = await encryptSession(sampleSession().toData(), 'une phrase de passe', ITERATIONS);
    const b = await encryptSession(sampleSession().toData(), 'une phrase de passe', ITERATIONS);
    if (!a.ok || !b.ok) throw new Error('chiffrement impossible');
    expect(a.payload).not.toBe(b.payload);
  });

  it(`exige une phrase de passe d'au moins ${MIN_PASSPHRASE_LENGTH} caractères`, async () => {
    const r = await encryptSession(sampleSession().toData(), 'court', ITERATIONS);
    expect(r.ok).toBe(false);
  });

  it('refuse un nombre d\'itérations hors limites', async () => {
    expect((await encryptSession(sampleSession().toData(), 'une phrase de passe', 10)).ok).toBe(false);
    expect((await encryptSession(sampleSession().toData(), 'une phrase de passe', 1e9)).ok).toBe(false);
  });

  it.each([
    ['pas du JSON', 'pas du json'],
    ['objet vide', '{}'],
    ['version inconnue', '{"v":2,"kdf":"PBKDF2-SHA256","iter":1000,"salt":"AA==","iv":"AA==","ct":"AA=="}'],
    ['itérations excessives', '{"v":1,"kdf":"PBKDF2-SHA256","iter":999999999,"salt":"AA==","iv":"AA==","ct":"AA=="}'],
    ['sel de mauvaise taille', '{"v":1,"kdf":"PBKDF2-SHA256","iter":1000,"salt":"AA==","iv":"AA==","ct":"AA=="}'],
    ['base64 invalide', '{"v":1,"kdf":"PBKDF2-SHA256","iter":1000,"salt":"!!!","iv":"!!!","ct":"!!!"}'],
  ])('refuse un contenu invalide : %s', async (_name, payload) => {
    const dec = await decryptSession(payload, 'une phrase de passe');
    expect(dec.ok).toBe(false);
  });
});
