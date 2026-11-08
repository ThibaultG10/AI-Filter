# Directory templates / Modèles d'annuaire

| File | Language |
|---|---|
| `annuaire-modele.csv` | Français (en-tête `terme;categorie;alias`) |
| `directory-template.csv` | English (header `term;category;aliases`) |

**How to use / Mode d'emploi**

1. Open the file in a spreadsheet (LibreOffice, Excel, Google Sheets). / Ouvrez le fichier dans un tableur.
2. **Delete the example rows** (they are fictional) and enter your own terms: one per line. / **Supprimez les lignes d'exemple** (fictives) et saisissez vos termes, un par ligne.
3. Save as CSV (UTF-8, separator `;`). / Enregistrez en CSV (UTF-8, séparateur `;`).
4. In the tool: *Forbidden terms directory → Import a file*. / Dans l'outil : *Annuaire → Importer un fichier*.

**Columns / Colonnes**

- `term` / `terme`: the word or expression to mask (2 to 200 characters). / Le mot ou l'expression à masquer.
- `category` / `categorie`: `CLIENT`, `PERSON`/`PERSONNE`, `PROJECT`/`PROJET`, `SERVER`/`SERVEUR`, `INTERNAL`/`INTERNE`, or your own. It becomes the token name (`[CLIENT_1]`). Empty = `INTERNAL`. / Devient le nom du jeton.
- `aliases` / `alias`: other spellings, separated by `|` (up to 50). / Autres graphies, séparées par `|`.

**Good to know / Bon à savoir**

- Matching ignores case, accents and repeated spaces: `élodie` = `ELODIE`. / La recherche ignore casse, accents et espaces multiples.
- Rows with an empty term or an invalid category are reported by line number and skipped; the others are imported. / Les lignes invalides sont signalées, les autres importées.
- Keep your real directory **out of the repository**: it is the list of what you want to protect. / Gardez votre vrai annuaire **hors du dépôt** : c'est la liste de ce que vous protégez.
- A formula-like value (starting with `=`, `+`, `-`, `@`) is protected on export against spreadsheet injection. / Une valeur commençant par `=`, `+`, `-` ou `@` est protégée à l'export.
