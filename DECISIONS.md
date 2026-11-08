# Décisions

## Jalon 1

- **Dépendances (toutes en dev, aucune embarquée dans le build)** :
  - `vite` : outil de build demandé par le cadrage.
  - `typescript` : TypeScript strict demandé par le cadrage.
  - `vitest` : tests unitaires demandés par le cadrage.
  - `@types/node` : types pour les tests qui lisent le système de fichiers (`node:fs`).
- **Lint = `tsc --noEmit`** : pas d'ESLint pour l'instant, pour limiter les dépendances. Le compilateur en mode strict (avec `noUncheckedIndexedAccess`, `noUnusedLocals`) fait office de lint. ESLint pourra être ajouté si besoin.
- **UI en TypeScript vanilla**, sans framework : le cadrage autorise Preact ou vanilla, et le projet reste petit.
- **CSP injectée au build uniquement** (plugin Vite `strict-csp`) : en développement, Vite injecte des scripts inline pour le rechargement à chaud, qu'une CSP stricte bloquerait. Le build de production contient la CSP complète.
- **Garde-fou « zéro réseau » statique dès maintenant** (`tests/no-network.test.ts`) : en attendant le test e2e Playwright du jalon 6, un test échoue si le code source contient un appel réseau ou `eval`.
- **Playwright reporté au jalon 6** : inutile avant d'avoir une interface complète, et il alourdit l'installation.
- **Build mono-fichier reporté au jalon 6** : prévu par le cadrage au même jalon que la qualité.
- **Types `Match` et `Detector`** posés dès le jalon 1 dans `src/core/types.ts` pour figer le contrat du moteur avant son implémentation.

## Jalon 2

- **Validateurs obligatoires** (`src/core/validators.ts`) : Luhn (cartes, SIREN, SIRET), modulo 97 (IBAN), clé NIR, plages IPv4, structure IPv6. Un nombre quelconque de 16 chiffres n'est jamais masqué comme une carte.
- **Carte bancaire** : en plus de Luhn, le préfixe doit correspondre à un réseau connu (Visa, Mastercard, Amex, Diners, JCB, Discover/UnionPay) avec la bonne longueur. Cela écarte par exemple deux dates collées (« 2024-01-15 2024-01-16 »).
- **IBAN** : longueur vérifiée pour 12 pays courants (AT, BE, CH, DE, ES, FR, GB, IE, IT, LU, NL, PT) ; pour les autres, plage 15-34 + modulo 97. Majuscules uniquement.
- **NIR** : la clé de 2 chiffres est obligatoire (15 caractères). Sans clé, aucune validation n'est possible, donc pas de détection. Corse : 2A → 19, 2B → 18 pour le calcul.
- **SIRET** : exception La Poste (SIREN 356000000, somme des chiffres multiple de 5) acceptée en plus de Luhn.
- **IPv4** : les octets avec zéro initial (« 01 ») sont refusés, ce qui évite de masquer des numéros de version ou de date.
- **Résolution des chevauchements** (`src/core/overlap.ts`) : tri par rang (annuaire avant détecteurs), puis longueur décroissante, puis ordre de déclaration. Le rang « annuaire » est déjà prévu pour le jalon 3.
- **Un détecteur = une regex + un validateur optionnel + une catégorie** : plusieurs détecteurs peuvent partager une catégorie (`TEL`, `IP`, `CLE_API`), ce qui donnera des jetons cohérents (`[TEL_1]`).
- **Robustesse (ReDoS)** : lookbehind en tête de regex pour ne tenter un départ qu'au début d'une séquence, quantificateurs bornés, bloc PEM limité à 8 192 caractères (au-delà, seul l'en-tête est masqué). Vérifié par 20 entrées adverses de 50 000 caractères (chacune < 300 ms ; la suite complète de robustesse s'exécute en environ 140 ms).
- **Copie de la regex à chaque détection** (`new RegExp(source, flags)`) : évite tout état partagé (`lastIndex`) entre deux appels.
- **URL internes** : détecteur construit à partir d'une liste de domaines (`createDetectors({ internalDomains })`), désactivé et sans correspondance possible tant que la liste est vide. Les domaines sont normalisés (`*.` et point initial retirés) et filtrés.
- **Faux positifs assumés** : un SIREN valide par Luhn (≈ 10 % des nombres à 9 chiffres) est masqué ; un numéro de version à 4 nombres valides (ex. 1.2.3.4) est vu comme une IPv4. Mieux vaut masquer à tort que laisser fuir ; l'aperçu du jalon 5 permettra de démasquer.
- **Tests** : 577 tests, dont au moins 10 cas positifs et 10 cas négatifs par détecteur (vérifié par un test), tests dédiés des validateurs, de la résolution des chevauchements, d'un texte contenant tous les types de données, de robustesse et de performance.

## Jalon 3

- **Écart au cadrage (priorité annuaire / détecteur)** : le cadrage dit « l'annuaire gagne » en cas de chevauchement. Appliqué littéralement, un terme comme « Dupont » découpait l'e-mail `jean.dupont@dupont-sa.fr` en `jean.[CLIENT_1]@[CLIENT_1]-sa.fr` et laissait fuir « jean » et le reste de l'adresse. Règle retenue : un terme d'annuaire **entièrement contenu dans une correspondance plus longue d'un détecteur** est écarté (masquer la donnée entière masque aussi le terme). Dans tous les autres cas, le cadrage s'applique : l'annuaire l'emporte (étendue identique, chevauchement partiel, terme plus long). **À valider avec le porteur du projet.** Limite restante : en chevauchement partiel, la partie de la donnée détectée hors du terme reste visible.
- **Correspondance accents / casse / espaces** (`src/core/normalize.ts`) : les deux textes sont normalisés (décomposition NFD, accents retirés, minuscules, apostrophes et tirets typographiques unifiés, suites d'espaces réduites à une), avec une table de correspondance vers les positions d'origine. La valeur masquée est donc toujours la portion exacte du texte d'origine (casse, accents et espaces conservés).
- **Frontières de mots** : un terme n'est trouvé que s'il n'est pas collé à une lettre ou un chiffre Unicode (`\p{L}`, `\p{N}`). Le tiret bas compte comme séparateur (masque « Dupont » dans `client_Dupont_id`). La frontière n'est exigée que du côté où le terme commence ou finit par une lettre ou un chiffre (« C++ », « S.A. » fonctionnent).
- **Garde-fous sur les termes** : 2 caractères minimum (un terme d'une lettre masquerait trop de choses), 200 maximum, 50 alias maximum, alias sans « | ». Catégorie : majuscules, chiffres et « _ », commençant par une lettre, 32 caractères maximum (elle sert à fabriquer les jetons).
- **Catégorie par défaut INTERNE** quand un import n'en fournit pas, pour accepter une simple liste de termes.
- **Doublons** : le terme déjà présent l'emporte (`mergeEntries`) ; si une même clé est déclarée dans deux catégories, la première l'emporte et le conflit est signalé (`conflicts`).
- **CSV** : séparateur détecté (`;`, `,`, tabulation), `;` à l'export (Excel en français), BOM et fins de ligne Windows acceptés, en-tête facultatif (colonnes dans n'importe quel ordre), guillemets non fermés signalés. **Protection contre l'injection de formules** : à l'export, une cellule qui commence par `= + - @` (ou tabulation / retour chariot) est précédée d'une apostrophe, retirée à l'import.
- **Import tolérant** : une ligne invalide est signalée avec son numéro (ligne du CSV, position dans le tableau JSON) mais n'empêche pas l'import des autres. Limite de 50 000 entrées par import.
- **Recherche** : un `indexOf` par terme sur le texte normalisé (coût proportionnel au nombre de termes × longueur du texte). 1 000 termes sur 50 000 caractères restent sous 300 ms (vérifié par un test). Un Aho-Corasick serait l'étape suivante pour des annuaires de plusieurs dizaines de milliers de termes.
- **`engine.ts`** : point d'entrée `analyze(texte, { detectors, directory })`, qui combine détecteurs et annuaire. L'interface (jalon 5) n'appellera que cette fonction.
- **URL internes** : le chemin ne se termine plus par une ponctuation de fin de phrase (« …/phenix. » masque « …/phenix », le point reste).
- **Script de démo** (`npm run demo`) : lancé par `vite-node`, déjà installé avec Vitest (aucune dépendance ajoutée). Les jetons y sont un simple aperçu ; la pseudonymisation réversible arrive au jalon 4.
- **Tests** : 680 au total (détecteurs, validateurs, normalisation, annuaire, import/export, moteur, chevauchements, robustesse).

## Jalon 4 — Pseudonymisation réversible

- **Jetons** `[CATEGORIE_N]`, numérotés par catégorie dans l'ordre d'apparition ; une même valeur (insensible à la casse, aux accents et à la forme des espaces) garde le même jeton pendant toute la session.
- **Graphie restituée** : c'est la première graphie rencontrée. `Dupont` puis `DUPONT` → un seul jeton, restauré en `Dupont`. L'identité exacte `restore(clean(t)) === t` est donc garantie quand chaque valeur est écrite toujours de la même façon (cas du corpus de test) ; sinon seule la casse peut différer, jamais la donnée. Choix assumé : la stabilité du jeton (l'IA voit une seule entité) prime sur la fidélité typographique.
- **Collision avec de faux jetons** : si le texte contient déjà `[EMAIL_1]`, `EMAIL_1` ou `[ email_1 ]`, ces numéros sont réservés et non attribués. Limite : dans une session longue, un faux jeton saisi *après* qu'un vrai jeton de même nom a été attribué sera restauré par erreur.
- **Restauration tolérante** : minuscules, espaces dans les crochets, échappements markdown (`\[CLIENT\_1\]`), gras, zéros initiaux, jetons nus en MAJUSCULES connus. Les valeurs sont insérées par callback et jamais relues (pas de `$&`, pas de double remplacement).
- **Rapport** : `missing` (jetons envoyés mais absents de la réponse), `unknown` (jetons que l'IA a inventés, laissés tels quels).
- **Session persistante (optionnelle)** : AES-GCM 256, PBKDF2-SHA256 600 000 itérations, sel et IV aléatoires, phrase de passe ≥ 8 caractères, jamais stockée. Rien n'est écrit sans action explicite de l'utilisateur.
- **Tests** : 100 textes seedés (aller-retour, session neuve et partagée, aucune valeur sensible résiduelle, réponse d'IA simulée).

## Jalon 5 — Interface

- **Architecture** : `src/ui/model.ts` (toute la logique, sans DOM, testée en Node), `storage.ts` (localStorage protégé par try/catch), `dom.ts` (helper `h()`, aucun `innerHTML`), `app.ts` (rendu et événements). Textes dans `src/config/texts.ts`.
- **Seul le texte analysé est nettoyé** : si le texte est modifié après « Analyser », « Valider » est désactivé jusqu'à une nouvelle analyse. Ce qu'on voit dans l'aperçu est exactement ce qui est remplacé.
- **Faux positifs par valeur** : cliquer une marque (bouton, `aria-pressed`) démasque *toutes* les occurrences de la valeur, pas une seule : une même valeur a un seul jeton, et un démasquage partiel serait source de fuites.
- **Masquage manuel** : sélection dans le champ de texte → toutes ses occurrences masquées via l'annuaire (temporaire par défaut, permanent sur case à cocher). Pas de sélection dans l'aperçu : trop fragile sur mobile et au clavier.
- **Stockage** : réglages et annuaire en localStorage, **en clair** (signalé dans l'interface) ; session uniquement chiffrée, sur action explicite ; « Tout effacer » supprime tout. Écart/risque à valider : un annuaire sensible en clair sur un poste partagé.
- **Aucun style en ligne** (CSP) ; copie par `navigator.clipboard` avec repli `execCommand` (cas `file://`) ; export par Blob.
- **Test** : `happy-dom` ajouté en devDependency pour les tests d'interface (22 tests). Vérifié aussi dans Chromium réel : parcours complet, 0 erreur de console, 0 requête externe, CSP stricte active.

## Jalon 6 — Qualité

- **Fichier unique** : `npm run build:single` produit `dist-single/filtre-ia.html` (script et style en ligne). La CSP n'autorise **que** les empreintes SHA-256 de ce script et de ce style : ni `'unsafe-inline'`, ni `'self'`, ni domaine. Le `</script` éventuel du code est échappé avant le calcul de l'empreinte (testé). `base: './'` rend aussi `dist/` utilisable derrière n'importe quel chemin.
- **E2E** : `npm run e2e` (Playwright-core + Chrome système, `CHROME_PATH` pour en choisir un autre) ouvre le fichier unique en `file://`, bloque tout ce qui n'est pas local, puis déroule le parcours complet, l'export de l'annuaire et la session chiffrée rechargée après rechargement de page. Il échoue sur la moindre requête externe, erreur console ou violation CSP. Il n'est pas dans `npm test` car il exige un navigateur.
- **Contraste** : test automatique WCAG AA sur les variables CSS des deux thèmes. Il a révélé que les bordures de champs (`--bd`, ratio ≈ 1,7) étaient sous le seuil de 3:1 des composants d'interface : ajout de `--ctl` pour les contrôles.
- **Audit des regex** : `docs/REGEX-AUDIT.md`, avec tests adverses pour les regex ajoutées au jalon 4.

## Jalon 7 — Livraison

- README remanié (démarrage rapide, stockage, limites), `docs/GUIDE-UTILISATEUR.md` ajouté.
- **Questions ouvertes pour le propriétaire du projet** (aucune ne bloque la livraison) :
  1. Écart au cadrage (jalon 3) : un terme d'annuaire entièrement contenu dans une donnée détectée plus longue cède la place à la donnée. À valider.
  2. Annuaire et réglages en localStorage **en clair** : acceptable, ou faut-il tout chiffrer par phrase de passe (au prix d'une saisie à chaque ouverture) ?
  3. Cible (usage personnel, équipe, produit), extension Chrome V2, langues autres que le français, modèle économique, nom du produit.

## Jalon 8 — Anglais et formats US/UK

- **i18n** : `src/config/texts.ts` contient `FR` (référence) et `EN` ; le type `Texts` impose les mêmes clés. Langue : choix mémorisé, sinon langue du navigateur (français si elle commence par « fr », anglais sinon). Changer de langue remonte l'interface en conservant le modèle (session, analyse) et les champs.
- **Catégories de jetons par langue** : les catégories internes restent en français (stables pour l'annuaire et les données déjà exportées) ; seul le nom affiché dans le jeton change (`TEL` → `PHONE`, `PERSONNE` → `PERSON`…), appliqué au moment de la validation. La restauration accepte les jetons des deux langues, car elle s'appuie sur la table de la session. Limite : changer de langue en cours de session peut créer un second jeton pour une même valeur dans une catégorie renommée.
- **Tous les détecteurs restent actifs dans les deux langues** : un utilisateur français traite aussi des données américaines, et inversement.
- **Nouveaux détecteurs** : `ssn` (séparateurs obligatoires, règles de zone/groupe/série), `nino` (lettres de préfixe valides, suffixe A-D, majuscules uniquement), `phone-us` (plan NANP ; « 1 » nu exigeant un séparateur, pour ne pas lire « 1234 555 2671 » comme un numéro), `phone-uk` (formats nationaux 07…, 02x, 011x/01x1, 01xxx, 03/08 ; les formats +44 restent couverts par `phone-intl`). Non faits : EIN, passeport, codes postaux (faux positifs élevés pour une valeur sensible faible).
- **Faux jetons Slack dans les tests** : construits par concaténation à l'exécution, car la protection des dépôts GitHub bloque tout littéral ayant la forme d'un jeton.
- **Documentation** : `README.md` en anglais (référence sur GitHub), `README.fr.md`, `docs/USER-GUIDE.md` et `docs/GUIDE-UTILISATEUR.md`.
