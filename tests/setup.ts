// Node 18 n'expose pas WebCrypto globalement (Node ≥ 19 le fait) : on le branche pour les tests.
// Les navigateurs, eux, l'ont toujours ; ce fichier ne fait donc pas partie de l'application.
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
