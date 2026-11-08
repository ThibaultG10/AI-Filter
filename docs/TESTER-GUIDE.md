# Guide pour les testeurs (15 minutes)

Merci de tester **Filtre IA**. L'outil masque les données sensibles d'un texte avant de l'envoyer à une IA (ChatGPT, Claude, Gemini…), puis remet les vraies valeurs dans la réponse. Tout se passe dans votre navigateur : rien n'est envoyé sur Internet.

> C'est un projet de quelqu'un qui n'est pas développeur de métier : **il peut se tromper**. Votre rôle est justement de le mettre en défaut. Et il réduit le risque, il ne le supprime pas : relisez toujours le texte avant de l'envoyer.

## Ce qu'on vous demande

**1. Un texte à vous (5 min).** Prenez un texte que vous enverriez vraiment à une IA (un mail, un extrait de dossier, un message d'erreur). Collez-le dans l'outil, cliquez sur **Analyser**, regardez ce qui est surligné.

**2. Le parcours complet (5 min).** Cliquez sur **Valider et masquer**, copiez le texte nettoyé dans l'IA de votre choix, demandez par exemple « résume ce texte » ou « réponds à ce mail », puis collez la réponse dans l'étape 3 et cliquez sur **Restaurer**.

**3. Les cas piégeux (5 min).** Essayez :
- un mot interne ou un nom de client : ajoutez-le à l'annuaire, vérifiez qu'il est masqué partout (majuscules, accents) ;
- un numéro écrit à votre façon (avec des points, des espaces, un indicatif) ;
- une valeur que l'outil masque à tort : cliquez dessus pour la démasquer.

## Ce qu'on veut savoir

1. Des données sensibles ont-elles été **oubliées** ? Lesquelles, sous quelle forme ?
2. Des éléments ont-ils été **masqués à tort** ? Lesquels ?
3. L'IA a-t-elle bien compris le texte avec les jetons (`[CLIENT_1]`…), et la restauration était-elle correcte ?
4. Où avez-vous **hésité** ou été perdu ?
5. L'utiliseriez-vous **réellement, plus d'une fois** ? Sinon, qu'est-ce qui manque ? (Le copier-coller est-il trop pénible ? Faut-il une extension du navigateur ?)

## Comment répondre

- Réponse libre par message, ou
- Une « issue » sur GitHub : <https://github.com/ThibaultG10/AI-Filter/issues/new/choose> (formulaires prêts).

**⚠️ Dans votre retour, n'écrivez jamais les vraies données.** Remplacez-les par des valeurs du même format (`06 12 34 56 78`, `jean@example.com`). Un retour qui contient un vrai IBAN ou une vraie clé est lui-même une fuite.

## Message d'invitation (à copier)

> Salut, je teste un petit outil que j'ai construit pour ne pas envoyer de données sensibles aux IA : il masque les téléphones, IBAN, e-mails, noms de clients… dans un texte avant de l'envoyer, puis remet les vraies valeurs dans la réponse. Tout reste dans le navigateur. Ça te prendrait 15 minutes pour l'essayer sur un de tes vrais textes et me dire ce qu'il oublie ou masque à tort ? Je ne suis pas développeur de métier, donc il y a sûrement des défauts : c'est ça que je cherche. Guide : [lien vers le guide]. Outil : [lien vers la page].
