# Guide d'utilisation de Filtre IA

> Réduction du risque, pas de garantie absolue : relisez toujours avant d'envoyer.

## Ouvrir l'outil

Double-cliquez sur `filtre-ia.html`. Il s'ouvre dans votre navigateur et fonctionne sans connexion. Rien n'est envoyé nulle part.

## Utiliser en 3 étapes

**1. Votre texte.** Collez votre prompt, cliquez sur **Analyser**.

**2. Vérification.** Les éléments détectés (téléphones, e-mails, IBAN, IP, clés, termes de votre annuaire…) sont surlignés avec leur catégorie.
- Un élément à tort ? Cliquez dessus : il n'est plus masqué (toutes ses occurrences). Recliquez pour le remasquer.
- Un mot oublié ? Sélectionnez-le dans le texte de l'étape 1, choisissez une catégorie, cliquez sur **Masquer la sélection**. Cochez « Ajouter à l'annuaire » pour le garder pour la prochaine fois.
- Cliquez sur **Valider et masquer**, relisez le texte nettoyé, puis **Copier** et collez-le dans l'IA.

**3. Réponse de l'IA.** Collez la réponse (avec ses `[CLIENT_1]`, `[EMAIL_2]`…), cliquez sur **Restaurer**. Le rapport indique les jetons restaurés, ceux que l'IA a inventés et ceux qui n'apparaissent pas dans sa réponse.

> Gardez la page ouverte entre l'envoi et la restauration : les jetons n'existent qu'en mémoire. Pour les conserver, utilisez « Session et stockage » → « Enregistrer la session chiffrée ».

## Annuaire

Section « Annuaire des termes interdits » : noms de clients, de personnes, de projets, de serveurs… avec des variantes facultatives. La recherche ignore la casse, les accents et les espaces multiples. Import et export en JSON ou CSV (`terme;categorie;alias`, alias séparés par `|`). Un exemple est fourni dans `examples/annuaire.csv`.

## Réglages

- Activez ou désactivez chaque détecteur (par exemple « SIREN » si trop de faux positifs).
- Indiquez vos domaines internes (`entreprise.local`) pour masquer les URL internes.

## Confidentialité

- Aucun envoi réseau, aucune télémétrie.
- Annuaire et réglages sont enregistrés **en clair** dans ce navigateur. Sur un poste partagé, cliquez sur **Tout effacer** à la fin.
- Une session enregistrée est chiffrée avec votre phrase de passe (8 caractères minimum). Si vous l'oubliez, elle est irrécupérable.

## Ce que l'outil ne fait pas

- Il ne détecte pas les noms propres absents de l'annuaire.
- Il ne traite pas les images, PDF ou pièces jointes.
- Un contexte peut identifier une personne même sans donnée masquée. Relisez.
- L'IA peut reformuler ou omettre un jeton : la restauration n'est pas garantie à 100 %.
