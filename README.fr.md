# Filtre IA

🇬🇧 [English version](README.md) · 🇫🇷 Version française (ce fichier)

Outil d'anonymisation **100 % local** : il masque les données sensibles d'un texte avant son envoi à une IA (ChatGPT, Claude, Gemini…), puis remet les vraies valeurs dans la réponse.

> Réduction du risque, pas de garantie absolue : relisez toujours avant d'envoyer.

## Démarrage rapide

**Sans rien installer** : ouvrez `filtre-ia.html` (fichier unique fourni) dans votre navigateur. Il fonctionne hors ligne, depuis un simple double-clic. Voir `docs/GUIDE-UTILISATEUR.md` (français) ou `docs/USER-GUIDE.md` (anglais).

**Depuis les sources** (Node 22.12 ou plus récent) :

```bash
npm install
npm run dev            # serveur de développement
npm run check          # typecheck + tests
npm run build:single   # produit dist-single/filtre-ia.html
npm run e2e            # test de bout en bout dans Chrome (après build:single)
```

## État d'avancement

| Jalon | Contenu | Statut |
|---|---|---|
| 1 | Socle : Vite, TypeScript, Vitest, CSP | Fait |
| 2 | Moteur de détection + validateurs | Fait |
| 3 | Annuaire (accents, casse, alias, import/export) | Fait |
| 4 | Pseudonymisation / restauration | Fait |
| 5 | Interface complète | Fait |
| 6 | Qualité (e2e, ReDoS, accessibilité, mono-fichier) | Fait |
| 7 | Documentation finale | Fait |

Le cahier des charges complet est dans `CADRAGE.md`.

## Données détectées

| Catégorie | Détecteur | Validation |
|---|---|---|
| E-mail | `email` | regex |
| Téléphone | `phone-fr` (06, +33, 0033…), `phone-us` (US/Canada), `phone-uk` (07…, 020…), `phone-intl` (E.164) | 8 à 15 chiffres ; plan de numérotation nord-américain pour `phone-us` |
| IP | `ipv4`, `ipv6` | octets 0-255 sans zéro initial ; groupes hexadécimaux |
| IBAN | `iban` | longueur par pays + modulo 97 |
| Carte bancaire | `card` | préfixe de réseau + Luhn |
| SIRET / SIREN | `siret`, `siren` | Luhn (exception La Poste pour le SIRET) |
| N° de sécurité sociale (FR) | `nir` | clé 97 − (NIR mod 97), Corse 2A/2B |
| N° de sécurité sociale (US) | `ssn` | séparateurs obligatoires ; zone ≠ 000/666/9xx, groupe ≠ 00, série ≠ 0000 |
| National Insurance (UK) | `nino` | lettres de préfixe valides, suffixe A-D |
| Clés et secrets | `api-key-sk`, `api-key-aws`, `api-key-github`, `api-key-slack`, `jwt`, `pem` | regex |
| URL internes | `internal-url` | domaines configurés (désactivé sans domaine) |

Usage du moteur (sans DOM) :

```ts
import { createDetectors, detect } from './src/core/detectors';

const detectors = createDetectors({ internalDomains: ['entreprise.local'] });
const matches = detect(texte, detectors); // [{ start, end, value, category }, …] sans chevauchement
```

## Annuaire des termes interdits (jalon 3)

Chaque entrée a un **terme**, une **catégorie** (CLIENT, PERSONNE, PROJET, SERVEUR, INTERNE, ou la vôtre) et des **alias** facultatifs.

- Insensible à la casse, aux accents, aux espaces multiples et aux retours à la ligne (« Élodie » = « ELODIE » = « Élodie »).
- Frontières de mots Unicode : « Dupont » est masqué dans « le dossier Dupont. » mais pas dans « Dupontel ».
- Priorité : le plus long terme l'emporte ; l'annuaire l'emporte sur un détecteur en cas de chevauchement partiel ; un terme entièrement contenu dans une donnée détectée (ex. « dupont » dans un e-mail) laisse la donnée entière être masquée.
- Import / export JSON et CSV (`src/core/directory-io.ts`). CSV : colonnes `terme;categorie;alias`, alias séparés par `|`, séparateur détecté automatiquement. Les lignes invalides sont signalées avec leur numéro, sans bloquer les autres.

Exemple : `examples/annuaire.csv`.

## Tester le projet

```bash
npm install
npm run check        # typecheck + tous les tests
npm run demo -- "Dossier Dupont SA, contact jean@example.com, 06 12 34 56 78" --dir examples/annuaire.csv
echo "Facture DUPONT, IBAN FR76 3000 6000 0112 3456 7890 189" | npm run demo -- --dir examples/annuaire.csv
npm run demo -- "voir https://git.entreprise.local/x" --domain entreprise.local
```

Le script `demo` affiche le texte nettoyé et la liste des éléments masqués.

## Licence, contributions et sécurité

Licence MIT (voir `LICENSE`). Pour aider ou signaler une donnée non détectée (avec de **fausses valeurs uniquement**), voir `CONTRIBUTING.md` ; pour signaler une faille en privé, voir `SECURITY.md`. Un guide pour les testeurs est dans `docs/TESTER-GUIDE.md`. Les contributions sont bienvenues : lancez `npm run check` avant toute proposition, et ajoutez des tests positifs et négatifs pour tout nouveau détecteur.

## Structure

```
src/core     moteur pur, sans DOM (réutilisable dans l'extension V2)
src/ui       interface (model.ts = logique sans DOM, app.ts = rendu)
src/config   textes et configuration par défaut
tests        tests unitaires et d'interface (Vitest, happy-dom)
scripts      démo en ligne de commande, build fichier unique, e2e
docs         guide utilisateur, audit des regex
```

## Confidentialité

- Aucune requête réseau, aucune télémétrie, aucun backend.
- Le build injecte une Content-Security-Policy stricte (`connect-src 'none'`).
- Le fichier unique n'autorise, par CSP, que l'empreinte SHA-256 de son propre script et de son style : aucun domaine, aucun `unsafe-inline`.
- Le test e2e bloque tout ce qui n'est pas local et échoue à la moindre requête.
- Un test statique (`tests/no-network.test.ts`) échoue si le code source contient `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval`, etc.

## Stockage local

- Réglages et annuaire : localStorage, **en clair** (l'annuaire contient justement vos termes sensibles). Bouton « Tout effacer » ; à utiliser sur un poste partagé.
- Jetons de session : en mémoire uniquement, sauf si vous choisissez « Enregistrer la session chiffrée » (AES-GCM 256, PBKDF2 600 000 itérations, phrase de passe jamais stockée).

## Langues

L'interface est disponible en français et en anglais (sélecteur FR/EN ; par défaut, la langue du navigateur). Les jetons suivent la langue : `[TEL_1]` en français, `[PHONE_1]` en anglais ; les deux sont restaurés quelle que soit la langue active. Changer de langue en cours de session peut créer un second jeton pour une même valeur dans une catégorie renommée (par exemple PERSONNE / PERSON) : les deux se restaurent correctement.

## Limites connues

- Les jetons de session sont perdus à la fermeture de la page si la session n'est pas enregistrée : sans eux, la réponse de l'IA ne peut plus être restaurée.
- Une valeur écrite avec des casses différentes (`Dupont`, `DUPONT`) partage un jeton et est restaurée sous sa première graphie.
- Dans une session longue, un faux jeton saisi par l'utilisateur (`[CLIENT_1]`) après l'attribution d'un vrai jeton identique peut être restauré par erreur.
- Traitement synchrone : très gros textes (plusieurs Mo) non optimisés.

- Les noms propres non listés dans l'annuaire ne sont pas détectés au MVP.
- Un n° de sécurité sociale sans sa clé (13 chiffres) n'est pas détecté : sans clé, impossible de le distinguer d'un nombre quelconque.
- Un SIREN (9 chiffres) valide par Luhn est masqué : environ 1 nombre à 9 chiffres sur 10 passe la clé, donc des faux positifs sont possibles. Le détecteur `siren` peut être désactivé.
- Les IBAN en minuscules ne sont pas détectés.
- Formats américains et britanniques : SSN avec séparateurs uniquement (9 chiffres nus non détectés), pas d'EIN, de passeport ni de code postal.
- Les URL internes ne sont détectées que pour les domaines configurés.
- Annuaire : pour les écritures sans espaces entre les mots (chinois, japonais…), la frontière de mot empêche de trouver un terme collé à d'autres lettres.
- Annuaire : en chevauchement partiel avec un détecteur, l'annuaire l'emporte et la partie de la donnée détectée hors du terme reste visible.
- Un contexte peut identifier une personne sans qu'aucun terme interdit n'apparaisse.
- Les jetons peuvent être reformulés par l'IA : la restauration n'est pas garantie à 100 %.
- Les images, PDF et pièces jointes ne sont pas traités.
