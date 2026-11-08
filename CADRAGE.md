# Cadrage projet : « Filtre IA » (anonymisation de prompts avant envoi à une IA)

> Document destiné à un agent IA de développement (ex. Claude Code). Lis-le en entier avant d'écrire du code. En cas d'ambiguïté, applique les choix par défaut indiqués, note-les dans `DECISIONS.md`, et pose une question seulement si la décision est irréversible ou change le périmètre.

---

## 1. Contexte et problème

Les employés utilisent ChatGPT, Claude, Gemini, etc. au quotidien. Ils y collent souvent des données sensibles (noms de clients, e-mails, téléphones, IP, IBAN, contrats, extraits de code avec clés API) sans en mesurer le risque. Interdire l'IA est inefficace ; former tout le monde ne suffit pas.

**Objectif produit** : un outil simple qui nettoie un texte *avant* qu'il parte vers une IA (masquage des données sensibles), puis permet de *remettre* les vraies données dans la réponse de l'IA.

**Principe fondateur** : tout le traitement se fait **en local**. Aucune donnée ne quitte le poste de l'utilisateur pour être nettoyée. Un outil de nettoyage qui envoie le texte à un serveur serait lui-même une fuite.

**Promesse honnête** : « réduction du risque », jamais « zéro fuite garantie ». Cette formulation doit apparaître dans l'interface et la documentation.

## 2. Utilisateurs cibles

- **Utilisateur final** : salarié non technique (RH, commercial, juridique, support). Doit être utilisable sans formation, en un clic.
- **Administrateur / RSSI** : définit l'annuaire des termes interdits de l'entreprise, choisit les détecteurs actifs, veut une preuve que rien ne sort.

## 3. Périmètre

### MVP (à livrer en premier)

1. Application web locale (page statique, fonctionne hors ligne) : coller un texte, nettoyer, copier, restaurer. **Une base existe déjà : `filtre-ia.html`** (prototype mono-fichier). La reprendre comme référence fonctionnelle, la restructurer proprement.
2. Détecteurs automatiques par motifs avec **validation** (voir §5).
3. Annuaire de termes interdits, éditable, avec catégories.
4. Pseudonymisation réversible (jetons `[CATEGORIE_N]`), restauration dans la réponse de l'IA.
5. Aperçu avec surbrillance avant copie.
6. Import / export de l'annuaire et de la configuration (JSON).

### Version 2 (ne pas développer maintenant, mais ne pas empêcher)

- **Extension Chrome (Manifest V3)** qui intercepte le champ de saisie de ChatGPT, Claude et Gemini, nettoie avant envoi, restaure dans la réponse affichée.
- Détection des noms propres par un petit modèle NER exécuté en local (WASM / ONNX).
- Configuration centralisée par l'entreprise (politique déployée via GPO / MDM).
- Journal local d'audit (compteurs uniquement, jamais le contenu).

### Hors périmètre

- Aucun backend, aucun compte utilisateur, aucune télémétrie, aucun appel réseau.
- Pas d'OCR, pas d'analyse d'images ni de fichiers (texte uniquement au MVP).
- Pas de promesse de conformité juridique (RGPD, NIS2) : l'outil est une aide, pas une certification.

## 4. Architecture et choix techniques (par défaut)

| Sujet | Choix |
|---|---|
| Langage | TypeScript strict |
| Build | Vite |
| UI | HTML/CSS simples, sans framework lourd (Preact ou vanilla acceptés) |
| Dépendances | Minimum. Chaque dépendance doit être justifiée dans `DECISIONS.md` |
| Stockage | `localStorage` / `IndexedDB`, jamais de cookie, jamais de réseau |
| Tests | Vitest (unitaires), Playwright (e2e) |
| Cible navigateur | Chrome, Edge, Firefox, Safari récents |
| Langue de l'interface | Français (i18n prévue, textes isolés dans un fichier) |

**Structure attendue**

```
/src
  /core          # logique pure, sans DOM, 100 % testable
    detectors.ts   # définitions des détecteurs + validateurs
    directory.ts   # annuaire personnalisé
    pseudonymize.ts# remplacement et table de correspondance
    restore.ts     # remise des vraies valeurs
  /ui            # interface
  /config        # configuration par défaut
/tests
CADRAGE.md
DECISIONS.md
README.md
```

**Règle d'architecture** : tout le moteur (`/core`) est indépendant de l'interface, afin d'être réutilisé tel quel dans l'extension Chrome en V2.

## 5. Spécification fonctionnelle

### 5.1 Détecteurs automatiques

Chaque détecteur a : un identifiant, un libellé, une regex, un **validateur optionnel** (pour limiter les faux positifs), un état activé/désactivé.

| Catégorie | Détail | Validation |
|---|---|---|
| E-mail | adresses standard | regex |
| Téléphone | formats FR (`06 12 34 56 78`, `+33 6…`, `0033…`), prévoir extension internationale (E.164) | regex |
| IPv4 | 4 octets 0-255 | plages valides |
| IPv6 | formes complètes et abrégées | regex |
| IBAN | tous pays | clé modulo 97 |
| Carte bancaire | 13-19 chiffres, séparateurs espace/tiret | algorithme de Luhn |
| SIRET / SIREN | 14 / 9 chiffres | Luhn |
| N° de sécurité sociale (NIR) | 13 chiffres + clé 2 chiffres, gestion Corse (2A/2B) | clé = 97 − (NIR mod 97) |
| Clés API / tokens | préfixes connus : `sk-`, `AKIA`, `ghp_`, `xox[baprs]-`, JWT (`eyJ…`), clés privées PEM (`-----BEGIN`) | regex |
| URL internes | domaines à configurer (`*.entreprise.local`, etc.) | liste configurable |

**Exigence** : les validateurs (Luhn, mod 97, clé NIR) sont obligatoires. Un numéro de 16 chiffres quelconque ne doit pas être traité comme une carte.

### 5.2 Annuaire personnalisé

- Liste de termes avec **catégorie** (CLIENT, PERSONNE, PROJET, SERVEUR, INTERNE, extensible).
- Correspondance **insensible à la casse et aux accents** ; frontières de mots Unicode (ne pas masquer « Dupont » dans « Dupontel »).
- Gestion des variantes : option par terme pour ajouter des alias (ex. « Dupont SA », « Dupont S.A. », « DUPONT »).
- Import / export JSON et CSV.
- Priorité : si un terme de l'annuaire et un détecteur se chevauchent, l'annuaire gagne ; à longueur égale, le plus long gagne ; pas de chevauchement dans le résultat.

### 5.3 Pseudonymisation réversible

- Chaque valeur distincte reçoit un jeton stable par catégorie : `[CLIENT_1]`, `[EMAIL_2]`.
- Une même valeur (insensible à la casse) → toujours le même jeton dans la session.
- Le jeton doit survivre à une reformulation par l'IA : format court, délimité par crochets, sans caractères que les IA modifient volontiers.
- Table de correspondance **en mémoire uniquement** par défaut. Option explicite « garder la session » qui la stocke chiffrée localement (AES-GCM via WebCrypto, clé dérivée d'une phrase de passe) pour restaurer plus tard.
- Restauration : remplacer les jetons dans la réponse collée ; signaler les jetons non retrouvés et les jetons « inventés » par l'IA.

### 5.4 Parcours utilisateur

1. Coller le texte.
2. Cliquer **Nettoyer**.
3. Voir l'aperçu avec éléments masqués en surbrillance ; pouvoir **démasquer un élément** (faux positif) ou **en masquer un de plus** (sélection manuelle) avant validation.
4. **Copier** le texte nettoyé.
5. Envoyer à l'IA (hors outil).
6. Coller la réponse, cliquer **Restaurer**, copier le résultat.

### 5.5 Interface

- Mobile-first, lisible, thème clair/sombre automatique.
- Compteur : « N éléments masqués ».
- Bandeau permanent : « Traitement 100 % local. Réduction du risque, pas de garantie absolue : relisez avant d'envoyer. »
- Accessibilité : navigation clavier, contrastes AA, libellés pour lecteurs d'écran.

## 6. Exigences non fonctionnelles

- **Confidentialité** : zéro requête réseau. Ajouter une Content-Security-Policy stricte (`default-src 'none'; script-src 'self'; style-src 'self'`) et un test e2e qui échoue si une requête sortante est émise.
- **Performance** : 50 000 caractères traités en moins de 300 ms.
- **Robustesse** : pas de ReDoS. Toutes les regex doivent être auditées (pas de quantificateurs imbriqués ambigus) et testées sur des entrées adversariales.
- **Sécurité front** : aucun `innerHTML` avec contenu utilisateur non échappé ; pas d'`eval`.
- **Portabilité** : le build produit aussi un **fichier HTML unique** utilisable hors ligne.

## 7. Critères d'acceptation (MVP)

- [ ] Chaque détecteur a au moins 10 cas positifs et 10 cas négatifs en tests unitaires.
- [ ] Luhn, IBAN mod 97 et clé NIR ont des tests dédiés (valides et invalides).
- [ ] Un texte test contenant tous les types de données est entièrement masqué.
- [ ] Aller-retour : `restore(clean(texte)) === texte` sur un corpus de 100 textes variés.
- [ ] L'annuaire gère accents, casse, alias, frontières de mots.
- [ ] Aucun appel réseau (test e2e Playwright).
- [ ] 50 000 caractères en < 300 ms.
- [ ] Utilisable au clavier seul ; contrastes AA vérifiés.
- [ ] `README.md` explique installation, usage, limites connues.

## 8. Plan de travail par jalons

L'agent livre jalon par jalon, avec un commit propre et les tests verts à chaque étape. **Ne pas passer au jalon suivant si les tests du précédent échouent.**

1. **Socle** : projet Vite + TypeScript, lint, Vitest, structure de dossiers, CSP.
2. **Moteur de détection** : détecteurs + validateurs + tests.
3. **Annuaire** : normalisation, alias, priorités, import/export + tests.
4. **Pseudonymisation / restauration** : jetons stables, table de correspondance, tests aller-retour.
5. **Interface** : parcours complet, aperçu, correction manuelle des faux positifs / négatifs.
6. **Qualité** : tests e2e, test « zéro réseau », audit des regex (ReDoS), accessibilité, build mono-fichier.
7. **Documentation** : README, `DECISIONS.md`, limites connues.

## 9. Limites connues (à documenter, ne pas masquer)

- Les noms propres non listés dans l'annuaire ne sont pas détectés au MVP (pas de NER).
- Un contexte peut identifier une personne sans qu'aucun terme interdit n'apparaisse (« le directeur financier de l'entreprise X à Poitiers »).
- Les jetons peuvent être reformulés ou supprimés par l'IA ; la restauration n'est pas garantie à 100 %.
- Les données dans des images, PDF ou pièces jointes ne sont pas traitées.

## 10. Consignes de travail pour l'agent

- Écris les tests **avant ou avec** le code, jamais après coup.
- Petits commits, messages clairs en français.
- Pas de dépendance sans justification ; pas de bibliothèque qui appelle un service externe.
- Ne jamais journaliser le contenu des textes de l'utilisateur, même en debug.
- Si une exigence de ce document est irréaliste ou contradictoire, **signale-le** plutôt que de la contourner en silence.
- À la fin de chaque jalon : résumé de 5 lignes maximum (fait / à faire / points d'attention).

## 11. Questions ouvertes (à trancher avec le porteur du projet)

1. Cible principale : usage individuel, PME ou grand compte (impacte l'annuaire partagé et le déploiement) ?
2. Faut-il prévoir dès la V1 une extension Chrome, ou rester sur la page web ?
3. Langues à gérer en plus du français (formats de téléphone, identifiants nationaux) ?
4. Modèle économique envisagé (gratuit, licence par poste, abonnement) ?
5. Nom du produit définitif.
