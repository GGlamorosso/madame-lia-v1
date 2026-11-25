# Reprise du projet Madame Lia

Lire README.md avant toute modification. Site statique français dans dist/, déployable tel quel : conserver HTML/CSS/JavaScript natifs et le design actuel. Aucun framework, serveur de formulaire, service payant ou secret nécessaire.

## Décisions validées

- Contact WhatsApp/e-mail avec message prérempli et confirmation d’envoi dans l’application.
- GitHub personnel GGlamorosso, dépôt madame-lia-v1, public à la demande de l’utilisateur, branche main.
- Vercel se connecte sur l’autre ordinateur ; ne pas publier via l’ancien projet Sites.
- 55 photographies réelles du ZIP fourni sont intégrées, avec l’Instagram donné par l’utilisateur. Biographie, identité du portrait de présentation et mentions d’identification restent à valider. Ne pas inventer ces informations.

## Refonte actuelle

Palette blanc #ffffff et rouge #e33122 (drapeau fourni par l’utilisateur), noir verre très léger ponctuellement. Polices et effets originaux du plan Claude restaurés : Archivo variable, Cormorant italique, DM Mono, typo cinétique, révélations et loupe WebGL. Ne pas réécrire les textes ni changer les effets sans demande. Photos dans leurs couleurs originales : aucun filtre rouge ou traitement global ajouté, même pendant leur apparition ou dans le WebGL. Galerie initiale de 12 vues sur mobile/tablette et 20 sur ordinateur, puis bouton pour tout afficher. Les 55 photos couvrent 8 thèmes ; 11 thèmes configurés, dont voyage non réservable et 3 prestations sans photos. Formulaire en modale, contact direct sans JavaScript, WebGL décoratif avec repli HTML.

## Configuration et vérification

Source commune : dist/services.json. images.hero, images.aboutMain, images.aboutDetail et services[].photos utilisent src, alt, width, height, provisional et srcset facultatif. Formats locaux assets/ : jpg, jpeg, png, webp. La sélection horizontale utilise les photos avec select:true. Filtres, prestations et choix du formulaire sont générés depuis les thèmes ; bookable:false exclut une prestation, un thème sans photo n’a pas de filtre. Marquer les vraies photos provisional:false et retirer les références au provisoire dans leurs textes alternatifs.

Après édition : node scripts/sync-content.mjs puis node scripts/sync-content.mjs --check. Cet outil actualise aussi le HTML et le snapshot JSON de secours. Garder ce snapshot synchronisé pour ne pas réintroduire les anciens visuels si le fetch échoue. Les liens de contact HTML doivent rester corrects sans JavaScript si les coordonnées changent.

Prévisualiser : python3 -m http.server 4173 --directory dist. Vérifier 320/390/768/1440 px, filtres, visionneuse, clavier, formulaire, réduction des animations et absence d’erreur réseau. Contrôles navigateur facultatifs : voir README et scripts/verify.mjs.

## Avant publication finale

Recueillir vraies photos, bio validée, réseaux éventuels et identification de l’éditeur. Remplacer le texte des mentions de maquette par les données réelles et l’hébergeur choisi. Une fois l’adresse connue, ajouter canonical, og:url et og:image absolus. Ne pas annoncer le site comme portfolio réel tant que des visuels générés y restent présentés comme tels.

## Préférence de délégation

Pour une tâche longue ou gourmande en tokens, déléguer les sous-tâches adaptées à Qwen local s’il est disponible. Définir son périmètre, relire et vérifier son travail. Les décisions, la coordination et la validation finale restent dans l’agent principal. Si Qwen est indisponible, poursuivre directement.
