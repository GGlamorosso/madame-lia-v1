# Madame Lia — site photographique

Site français en HTML, CSS et JavaScript natifs. Le dossier `dist/` est le site complet : aucune compilation, base de données, clé API ou installation nécessaire pour le consulter. Déploiement prévu sur Vercel.

## Ouvrir en local

```sh
python3 -m http.server 4173 --directory dist
```

Ouvrir http://localhost:4173. Ne pas ouvrir directement index.html en file://.

## État de la refonte

- Direction artistique du plan Claude conservée : fond blanc `#ffffff`, rouge `#e33122` échantillonné dans le drapeau Saint-Tropez fourni, quelques surfaces noir verre très léger.
- Typographie originale du plan : Archivo variable (largeur et graisse), Cormorant italique et DM Mono pour les marquages. Fichiers hébergés localement, sans requête à un fournisseur de polices ; licences dans `dist/assets/`.
- 55 photographies réelles sélectionnées dans le ZIP fourni par l’utilisateur, réparties entre mariage, naissance, famille, portrait, mode, événement, voiture et voyage. Deux images de présentation supplémentaires. Aucun ancien visuel généré n’est utilisé.
- Baptême, anniversaire et restaurant restent réservables, sans galerie inventée. Le voyage est un carnet personnel, sans prestation associée.
- La galerie « Tout » commence avec 12 photos sur mobile/tablette et 20 sur ordinateur. Le bouton permet d’afficher les 55 vues ; les filtres affichent toutes les photos du thème choisi.
- Visionneuse avec flèches, boucle, clavier, balayage tactile et accès au formulaire prérempli avec le thème.
- Formulaire ouvert depuis les boutons de contact. Barre fixe de réservation sur mobile, masquée dans le hero, à l’appel final et quand une modale est ouverte.
- Tirages flottants et loupe WebGL dans le hero, scène aux couleurs originales à l’appel final. Chargement progressif, arrêt hors écran ou onglet masqué. Images HTML et contact utilisables si WebGL est indisponible. Les préférences de réduction des animations sont respectées. Les photos gardent leurs couleurs originales dès leur apparition : aucun filtre rouge, monochrome, contraste ou grain ajouté.

## Modifier les contenus

La source commune est `dist/services.json` :

- `images.hero` : couverture ; `images.aboutMain` et `images.aboutDetail` : présentation.
- `services[]` : thèmes, titres, sous-titres, photos et `bookable` (facultatif, `true` par défaut). Un thème sans photo ne produit pas de filtre. `bookable: false` exclut un thème des prestations et du formulaire.
- Chaque photo contient `src`, `alt`, `width`, `height`, `provisional` et éventuellement `srcset` et `select`. `select: true` ajoute la photo à la sélection horizontale.
- Les filtres, prestations et choix du formulaire sont générés automatiquement depuis ces données.

Exemple de vraie photo (dimensions à adapter au fichier réel) :

```json
{
  "src": "assets/mariage-lia-01.jpg",
  "alt": "Description précise de la photographie",
  "width": 1600,
  "height": 1067,
  "provisional": false,
  "select": true
}
```

Déposer les fichiers dans `dist/assets/`. Formats JPEG/JPG, PNG, WebP ; noms sans espaces ni accents, avec lettres, chiffres, tirets ou underscores. `srcset` est facultatif ; chaque variante doit exister et indiquer sa largeur réelle. Utiliser des dimensions réelles, un texte alternatif descriptif et `provisional: false` pour les vraies photos.

Après chaque modification de configuration (Node.js nécessaire uniquement pour cet outil de développement) :

```sh
node scripts/sync-content.mjs
node scripts/sync-content.mjs --check
```

Cette commande vérifie les chemins et actualise les images HTML, le préchargement, les coordonnées, les réseaux et la copie de secours de la configuration. Le déploiement n’exécute aucune compilation. Le snapshot HTML conserve les mêmes photos et coordonnées si le chargement du JSON échoue. Les mentions provisoires suivent les données, y compris dans la visionneuse.

## Sélection et optimisation des photos

`design/photo-selection.json` documente les fichiers source, les textes alternatifs et les choix de placement. Les originaux du ZIP sont dans `photos-source/zip/`, ignoré par Git. Pour régénérer les WebP et les variantes jusqu’à 480, 800 et 1 200 px (sans agrandir les petites sources) :

```sh
# Outils système nécessaires : ffmpeg, ffprobe et cwebp.
node scripts/optimize-photos.mjs
node scripts/sync-content.mjs
node scripts/sync-content.mjs --check
```

Le script reconstruit les galeries d’après la sélection ; les modifications manuelles des photos de `services.json` seraient remplacées. Les fichiers optimisés de `dist/assets/` sont suffisants pour déployer le site. `design/image-prompts.json` est uniquement l’archive de l’ancienne maquette : aucun des visuels qu’il décrit n’est utilisé.

## Contact et contenus à valider avant publication

Dans `contact` : WhatsApp `33767220949`, e-mail `liapellegrin22@gmail.com`, Instagram `https://www.instagram.com/liashoots_/` (adresse donnée par l’utilisateur). Le script de synchronisation met aussi à jour les liens HTML directs pour qu’ils fonctionnent sans JavaScript.

Le formulaire prépare le message dans WhatsApp ou l’application e-mail. Le visiteur confirme l’envoi. Aucun message n’est envoyé ni stocké par le site.

Restent des données éditoriales à fournir ou valider par Lia :

- Biographie personnelle et éventuelle zone géographique ; les textes actuels sont une présentation éditoriale sans lieu, expérience ou diplôme inventé.
- Confirmation de l’identité de la personne sur l’autoportrait choisi pour « À propos ».
- Informations réelles d’identification de l’éditeur et d’hébergement dans les mentions.
- URL définitive : ajouter canonical, og:url et og:image absolus dans le head avec une vraie photo. Aucune adresse de production n’est inventée.

## Vercel et GitHub

Dépôt personnel public : `GGlamorosso/madame-lia-v1`. La refonte a été reprise sur la branche locale `refonte-da` ; elle n’est pas publiée par ces scripts.

Importer le dépôt dans Vercel avec **Root Directory = racine du dépôt**, **Framework Preset = Other**, **Output Directory = dist**. `vercel.json` fixe ces paramètres, sans commande d’installation ou de compilation. Aucune variable d’environnement nécessaire. Vercel se connecte sur l’autre ordinateur, après validation des contenus et des mentions.

L’ancien fichier `.openai/hosting.json` garde l’identité historique Sites ; il n’est pas utilisé par Vercel. Ne pas publier via cet ancien projet Sites.

## Vérifications

```sh
node scripts/sync-content.mjs --check
node --check dist/app.js
node --check dist/gl.js
```

Les contrôles navigateur sont dans `scripts/verify.mjs` et visent la structure actuelle. Installer les outils à part si nécessaire (`npm install --prefix qa playwright`, puis `cd qa && npx playwright install chromium`). Lancer le serveur local, puis :

```sh
node scripts/verify.mjs
# Ou avec Chrome déjà installé sur macOS :
BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/verify.mjs
```

`BASE_URL` permet de tester un autre serveur. Le script vérifie 320/390/768/1440 px, chargement des photos et polices, absence de débordement et de requêtes tierces, filtres, galerie complète, visionneuse, clavier, balayage, formulaire, liens de secours, modales, barre mobile, configuration de remplacement, JSON indisponible/invalide, fonctionnement sans JavaScript, scènes WebGL et réduction des animations. Il intercepte l’ouverture de WhatsApp/e-mail : aucun message de test n’est envoyé.

Captures et rapport `qa/verification.json` restent ignorés par Git.
