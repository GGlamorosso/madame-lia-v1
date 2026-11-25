# Reprise du projet Madame Lia

Lire README.md avant toute modification. Site statique français dans dist/, déployable tel quel : conserver HTML/CSS/JavaScript natifs et le design actuel. Aucun framework, serveur de formulaire, service payant ou secret nécessaire.

## Décisions validées

- Contact sans formulaire (demande de l’utilisateur) : chaque bouton « Réserver » ouvre WhatsApp avec un message prérempli, avec à côté les icônes Instagram et e-mail. Ne pas réintroduire de formulaire ni de choix de prestation obligatoire.
- Site multi-pages : accueil, À propos, Contact + FAQ, Mentions légales, Confidentialité, Espace client (livraison), 404. En-tête (menu mobile) et pied de page communs dans templates/.
- Livraison client : page brandée /livraison/#v1.… dont les données tiennent dans le fragment, vers le transfert (WeTransfer, SwissTransfer, Drive…) utilisé par Lia, et générateur /livraison/creer/. Aucune photo ni donnée client dans le dépôt public ; liste blanche des services dans dist/livraison.js.
- Tarifs : sur devis, aucun prix affiché.
- GitHub personnel GGlamorosso, dépôt madame-lia-v1, public à la demande de l’utilisateur, branche main.
- Vercel se connecte sur l’autre ordinateur ; ne pas publier via l’ancien projet Sites.
- 55 photographies réelles du ZIP fourni sont intégrées, avec l’Instagram donné par l’utilisateur. Biographie, identité du portrait de présentation et mentions d’identification restent à valider. Ne pas inventer ces informations.

## Refonte actuelle

Palette choisie par l’utilisateur : fond blanc #ffffff, olive #505b25 (titres), olive nuancée #838d4c (italiques des titres), terracotta #b04e2c (contraste : boutons, repères), texte #22231a. Ne modifier les couleurs que via les variables :root de dist/styles.css. La présentation de Lia est volontairement tôt : sur l’accueil, juste après la sélection et la bande défilante, démarche en haut de À propos. Polices et effets du plan Claude : Archivo variable, Cormorant italique, DM Mono, typo cinétique, révélations et tirages flottants WebGL. À la demande de l’utilisateur, la loupe WebGL (effet bulle) et les cercles rouges sur les photos sont retirés : ne pas les remettre. Ne pas réécrire les textes ni changer les effets sans demande. Photos dans leurs couleurs originales : aucun filtre rouge ou traitement global ajouté, même pendant leur apparition ou dans le WebGL. Galerie initiale de 12 vues sur mobile/tablette et 20 sur ordinateur, puis bouton pour tout afficher. Les 55 photos couvrent 8 thèmes ; 11 thèmes configurés, dont voyage non réservable et 3 prestations sans photos. Contact direct sans JavaScript, WebGL décoratif avec repli HTML.

## Configuration et vérification

Source commune : dist/services.json. images.hero, images.aboutMain, images.aboutDetail et services[].photos utilisent src, alt, width, height, provisional et srcset facultatif. Formats locaux assets/ : jpg, jpeg, png, webp. La sélection horizontale utilise les photos avec select:true. Filtres, prestations, liste de À propos et suggestions du générateur sont générés depuis les thèmes ; bookable:false exclut une prestation, un thème sans photo n’a pas de filtre. Marquer les vraies photos provisional:false et retirer les références au provisoire dans leurs textes alternatifs.

Après édition (données, gabarits templates/ ou pages) : node scripts/sync-content.mjs puis node scripts/sync-content.mjs --check. Cet outil traite toutes les pages de dist/ : gabarits partagés, page courante, coordonnées, images, liens internes et snapshot JSON de secours de l’accueil. Chemins depuis la racine (/assets/…, /contact/) dans tout le HTML. Garder ce snapshot synchronisé pour ne pas réintroduire les anciens visuels si le fetch échoue. Les liens de contact HTML doivent rester corrects sans JavaScript si les coordonnées changent.

Prévisualiser : python3 -m http.server 4173 --directory dist. Vérifier 320/390/768/1440 px sur toutes les pages, filtres, visionneuse, clavier, menu mobile, liens WhatsApp/Instagram/e-mail, livraison, réduction des animations et absence d’erreur réseau. Contrôles navigateur facultatifs : voir README et scripts/verify.mjs.

## Avant publication finale

Recueillir bio validée, relecture des textes À propos et FAQ, délais réels éventuels, réseaux éventuels et identification de l’éditeur. Remplacer les repères « à compléter » des mentions par les données réelles et vérifier l’hébergeur choisi (l’offre Hobby de Vercel est non commerciale). Une fois l’adresse connue, ajouter canonical, og:url et og:image absolus sur chaque page et un sitemap. Ne pas annoncer le site comme portfolio réel tant que des visuels générés y restent présentés comme tels.

## Préférence de délégation

Pour une tâche longue ou gourmande en tokens, déléguer les sous-tâches adaptées à Qwen local s’il est disponible. Définir son périmètre, relire et vérifier son travail. Les décisions, la coordination et la validation finale restent dans l’agent principal. Si Qwen est indisponible, poursuivre directement.
