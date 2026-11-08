# Audit des expressions régulières (ReDoS et performance)

Les textes analysés sont fournis par l'utilisateur : une regex à backtracking catastrophique pourrait figer l'onglet. Règles appliquées partout et vérifiées par des tests (`tests/robustness.test.ts`, `tests/token-format.test.ts`, `tests/restore.test.ts`, `tests/pseudonymize.test.ts`, `tests/directory.test.ts`).

## Règles

1. **Aucun quantificateur imbriqué ambigu** (`(a+)+`, `(a|a)*`…).
2. **Quantificateurs bornés** (`{0,31}`, `{1,6}`) dès qu'une borne existe : le travail par départ est borné.
3. **Lookbehind en tête** (`(?<![\w])…`) : un départ n'est tenté qu'au début d'une séquence, ce qui évite un coût quadratique sur une longue suite de caractères valides.
4. **Aucun état partagé** : chaque détection copie la regex (`new RegExp(source, flags)`), donc pas de `lastIndex` résiduel.
5. **Validation après la regex** : les contrôles lourds (Luhn, mod 97, clé NIR) s'appliquent à des candidats déjà bornés.
6. **Pas de regex pour l'annuaire** : recherche par `indexOf` sur le texte normalisé ; l'import CSV est un analyseur à états.

## Inventaire

| Fichier | Regex | Risque | Justification |
|---|---|---|---|
| `core/detectors.ts` | 21 détecteurs | Faible | Chacun suit les règles 1 à 5 ; 20 entrées adverses de 50 000 caractères testées (< 300 ms chacune). |
| `core/token-format.ts` | `BRACKETED_SOURCE`, `BARE_SCAN` | Faible | Nom borné à 32 caractères (paresseux), chiffres bornés à 6, espaces bornés à 3, lookbehind/lookahead en bordure. 8 entrées adverses testées. |
| `core/restore.ts` | combinaison des deux ci-dessus | Faible | Un seul passage ; valeurs insérées par callback, jamais relues. 6 entrées adverses + 5 000 jetons testés. |
| `core/pseudonymize.ts` | `TOKEN_FORMAT` | Nul | Ancrée, bornée, appliquée à des entrées de session déjà limitées. |
| `core/validators.ts` | NIR | Nul | Ancrée, longueur fixe. |
| `core/normalize.ts` | `\p{M}`, `\s` | Nul | Classes de caractères simples, sans répétition imbriquée. |
| `core/directory-io.ts` | `FORMULA_START` | Nul | Ancrée, un caractère. |
| `ui/model.ts`, `ui/app.ts` | extension de fichier, séparateurs de domaines | Nul | Linéaires. |

## Limites connues

- Les bornes protègent contre le blocage, pas contre un contournement volontaire : une donnée écrite de façon exotique (chiffres séparés par du texte, caractères Unicode « look-alike ») peut échapper aux détecteurs. C'est la limite documentée « réduction du risque, pas de garantie absolue ».
- Le traitement est synchrone dans le thread de l'interface. Pour des textes de plusieurs mégaoctets, un Web Worker serait préférable (non fait).
