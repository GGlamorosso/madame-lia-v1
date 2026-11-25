# liashoots — site photographique de Lia

Site français en HTML, CSS et JavaScript natifs. Le dossier `dist/` est le site complet : aucune compilation, base de données, clé API ou installation nécessaire pour le consulter. Déploiement prévu sur Vercel.

## Ouvrir en local

```sh
python3 -m http.server 4173 --directory dist
```

Ouvrir http://localhost:4173. Ne pas ouvrir directement index.html en file:// (les chemins partent de la racine du site).

## Pages

| Adresse | Fichier | Rôle |
| --- | --- | --- |
| `/` | `dist/index.html` | Accueil : pellicule d’ouverture, à propos, planche-contact, prestations, contact |
| `/a-propos/` | `dist/a-propos/index.html` | Démarche, prestations (vers le filtre du portfolio), carnets personnels |
| `/contact/` | `dist/contact/index.html` | Contact direct, « Comment ça se passe », questions fréquentes |
| `/mentions-legales/` | `dist/mentions-legales/index.html` | Éditeur, hébergement, propriété intellectuelle, crédits |
| `/confidentialite/` | `dist/confidentialite/index.html` | Données personnelles |
| `/livraison/` | `dist/livraison/index.html` | Espace client : page de livraison ouverte par un lien personnel |
| `/livraison/creer/` | `dist/livraison/creer/index.html` | Outil de Lia pour créer les liens de livraison (non référencé, lié nulle part) |
| — | `dist/404.html` | Page introuvable (servie automatiquement par Vercel) |

Scripts : `site.js` (toutes les pages : mouvement, menu mobile, barre de contact), `app.js` (accueil), `gl.js` (scènes WebGL de l’accueil), `livraison.js` (livraison et générateur).

## État du site

- Palette (choix de l’utilisateur) : fond blanc `#ffffff`, olive `#505b25` pour les titres, olive nuancée `#838d4c` pour les mots en italique, terracotta `#b04e2c` en contraste (boutons, repères, puces), texte noir olive `#22231a`. Toutes les couleurs sont des variables en tête de `dist/styles.css` ; le WebGL lit `--paper`. Contrastes vérifiés (AA ; la nuance ne sert qu’aux grands titres).
- Typographie : Archivo variable (largeur et graisse), Cormorant italique et DM Mono pour les marquages. Fichiers hébergés localement, sans requête à un fournisseur de polices ; licences dans `dist/assets/`.
- 55 photographies réelles du ZIP fourni, réparties entre mariage, naissance, famille, portrait, mode, événement, voiture et voyage, plus deux images de présentation. Baptême, anniversaire et restaurant restent réservables, sans galerie inventée. Le voyage est un carnet personnel, sans prestation associée.
- Présentation de Lia remontée : section « Moi, c’est Lia » sur l’accueil juste après la pellicule d’ouverture et la bande défilante, démarche dès le haut de la page À propos, « À propos » en tête de navigation.
- Nom affiché : **liashoots** (logo « Lia*shoots* », favicon « lia. »), comme l’Instagram @liashoots_.
- Ouverture : la pellicule de photos défile seule directement sous l’en-tête, sans grand titre (titre `h1` réservé aux lecteurs d’écran), suivie d’une phrase et des boutons Réserver / Voir les images. Pause au survol, au toucher, au clavier ou visionneuse ouverte ; glisser possible ; immobile en mouvement réduit. Les petites étiquettes de section et indications (« 01 Sélection », « Faites glisser »…) sont retirées.
- Photos sans aucun trait ni filtre : les anciens cercles rouges « crayon gras » sont retirés.
- La galerie « Tout » commence avec 12 photos sur mobile/tablette et 20 sur ordinateur, puis un bouton affiche les 55 vues. `/?theme=portrait#portfolio` ouvre directement un filtre.
- Visionneuse avec flèches, boucle, clavier et balayage tactile.
- WebGL : scène photo en parallaxe à l’appel final. Les tirages flottants du haut de page et **la loupe (effet bulle)** sont retirés. Chargement progressif, arrêt hors écran ou onglet masqué, images HTML si WebGL est indisponible, réduction des animations respectée.
- **Contact sans formulaire** : chaque bouton « Réserver » ouvre WhatsApp avec un message prérempli (la prestation est reprise depuis la liste des prestations ou la visionneuse), avec à côté les icônes Instagram et e-mail. Tout fonctionne sans JavaScript.
- En-tête commun avec menu plein écran sur mobile ; pied de page commun (navigation, infos, contact, réseaux, mentions) ; barre de réservation mobile sur l’accueil et À propos.

## Gabarits partagés

L’en-tête, le pied de page, les icônes et la barre mobile sont écrits une seule fois dans `templates/` (non déployé) :

- `templates/header.html`, `templates/footer.html`, `templates/sprite.html`, `templates/cta-bar.html`.

Chaque page contient des marqueurs `<!-- partial:nom --><!-- /partial:nom -->`. Certains blocs sont générés depuis `services.json` entre `<!-- generated:nom -->` (prestations et carnets de À propos, suggestions d’occasion du générateur). Pour une nouvelle page : copier une page existante (ex. `dist/mentions-legales/index.html`), garder les marqueurs, puis lancer la synchronisation. Utiliser des chemins depuis la racine (`/styles.css`, `/assets/…`, `/contact/`).

## Modifier les contenus

La source commune est `dist/services.json` :

- `images.hero` : photo d’ouverture, première de la pellicule et préchargée ; `images.aboutMain` et `images.aboutDetail` : présentation (accueil et À propos).
- `services[]` : thèmes, titres, sous-titres, photos et `bookable` (facultatif, `true` par défaut). Un thème sans photo ne produit pas de filtre. `bookable: false` exclut un thème des prestations.
- Chaque photo contient `src`, `alt`, `width`, `height`, `provisional` et éventuellement `srcset` et `select`. `select: true` ajoute la photo à la pellicule d’ouverture.
- `contact` : WhatsApp, e-mail et réseaux (`socials`, avec `label` et URL https).

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

Déposer les fichiers dans `dist/assets/`. Formats JPEG/JPG, PNG, WebP ; noms sans espaces ni accents, avec lettres, chiffres, tirets ou underscores. Les chemins de `services.json` restent relatifs (`assets/…`) : le HTML et le JS les servent depuis la racine.

Après chaque modification de configuration, de gabarit ou de page (Node.js nécessaire uniquement pour cet outil) :

```sh
node scripts/sync-content.mjs
node scripts/sync-content.mjs --check
```

L’outil parcourt toutes les pages de `dist/`. Il injecte les gabarits, signale la page courante dans la navigation et met à jour les images fixes, le préchargement, les coordonnées (WhatsApp, téléphone, e-mail, Instagram, messages préremplis conservés) et la copie de secours de la configuration de l’accueil. Il vérifie aussi que chaque lien interne et chaque image existent. Le déploiement n’exécute aucune compilation.

## Sélection et optimisation des photos

`design/photo-selection.json` documente les fichiers source, les textes alternatifs et les choix de placement. Les originaux du ZIP sont dans `photos-source/zip/`, ignoré par Git. Pour régénérer les WebP et les variantes jusqu’à 480, 800 et 1 200 px (sans agrandir les petites sources) :

```sh
# Outils système nécessaires : ffmpeg, ffprobe et cwebp.
node scripts/optimize-photos.mjs
node scripts/sync-content.mjs
node scripts/sync-content.mjs --check
```

Le script reconstruit les galeries d’après la sélection ; les modifications manuelles des photos de `services.json` seraient remplacées. `design/image-prompts.json` est uniquement l’archive de l’ancienne maquette : aucun des visuels qu’il décrit n’est utilisé.

## Livraison des photos aux clients

Principe : Lia continue d’envoyer les fichiers avec un service de transfert, et le site fournit une belle page de livraison à son nom. Aucune photo client n’est stockée sur le site ni dans le dépôt GitHub (public).

1. Déposer les photos sur WeTransfer, SwissTransfer, Google Drive, Google Photos, Dropbox, Smash, iCloud ou TransferNow et copier le lien.
2. Ouvrir `https://<domaine>/livraison/creer/` (sur téléphone ou ordinateur, depuis le site en ligne).
3. Remplir le nom affiché (« Julie & Tom »), coller le lien, puis si besoin l’occasion, la date de séance, la date d’expiration du transfert, le nombre d’images et le message.
4. « Copier le lien », « Envoyer sur WhatsApp » (choisir le contact) ou « Par e-mail ».

Le client ouvre une page « Julie & Tom, vos images sont prêtes » : message de Lia, bouton Télécharger, date limite, conseils de sauvegarde, Instagram et « Réserver une nouvelle séance ». Après la date d’expiration, la page propose de demander un nouveau lien par WhatsApp.

Fonctionnement : les informations sont encodées après le `#` de l’adresse (`/livraison/#v1.…`). Cette partie n’est jamais envoyée au serveur ni enregistrée. Pour empêcher qu’une fausse page liashoots renvoie vers un site piégé, seuls les services de la liste `SERVICES` de `dist/livraison.js` sont acceptés ; pour en ajouter un, compléter cette liste et la phrase d’aide du générateur. Les pages `/livraison/` sont exclues des moteurs de recherche (`noindex`, en-têtes Vercel). Les liens WeTransfer gratuits expirent en quelques jours ; SwissTransfer (jusqu’à 30 jours) ou Drive (sans expiration) sont plus confortables.

## Contact et contenus à valider avant publication

Dans `contact` : WhatsApp `33767220949`, e-mail `liapellegrin22@gmail.com`, Instagram `https://www.instagram.com/liashoots_/` (adresse donnée par l’utilisateur). Aucun message n’est envoyé ni stocké par le site : le visiteur écrit lui-même dans WhatsApp, son application e-mail ou Instagram.

Restent à fournir ou valider par Lia :

- Biographie personnelle et éventuelle zone géographique. Les textes de « Ma démarche » (À propos) sont une présentation éditoriale sans lieu, expérience ou diplôme inventé, à relire par Lia.
- Réponses de la FAQ (`/contact/`) : aucun prix, délai ni nombre d’images n’est annoncé. Ajouter les délais réels si Lia le souhaite.
- Confirmation de l’identité de la personne sur l’autoportrait choisi pour « À propos ».
- Mentions légales : nom, statut, SIRET, adresse et responsable de la publication (repères « à compléter » en pointillés terracotta). Vérifier l’adresse de l’hébergeur choisi au moment de la mise en ligne.
- URL définitive : ajouter canonical, og:url et og:image absolus dans le head de chaque page avec une vraie photo, puis un sitemap. Aucune adresse de production n’est inventée.

## Vercel et GitHub

Dépôt personnel public : `GGlamorosso/madame-lia-v1`, branche `main` (version à publier). La branche `refonte-da` sert au travail en cours.

### Mettre en ligne depuis un terminal (Vercel CLI)

Prérequis : Node.js (https://nodejs.org) et git. Sur le compte Vercel de la personne qui publie :

```sh
git clone https://github.com/GGlamorosso/madame-lia-v1.git ~/madame-lia
cd ~/madame-lia
npx vercel@latest login          # connexion au compte Vercel (navigateur)
npx vercel@latest deploy --prod  # crée le projet au premier lancement et publie dist/
```

Mise à jour ensuite : `cd ~/madame-lia && git pull && npx vercel@latest deploy --prod`. Ne rien modifier dans le code pour publier : `vercel.json` suffit.

Importer le dépôt dans Vercel avec **Root Directory = racine du dépôt**, **Framework Preset = Other**, **Output Directory = dist**. `vercel.json` fixe ces paramètres, sans commande d’installation ou de compilation, ajoute la barre finale aux adresses (`trailingSlash`) et les en-têtes `noindex`/`no-referrer` des pages de livraison. Aucune variable d’environnement nécessaire. Vercel se connecte sur l’autre ordinateur, après validation des contenus et des mentions. À noter : l’offre gratuite Hobby de Vercel est réservée à un usage non commercial ; pour un site d’activité, prévoir l’offre Pro ou un hébergeur statique gratuit autorisant l’usage commercial.

L’ancien fichier `.openai/hosting.json` garde l’identité historique Sites ; il n’est pas utilisé par Vercel. Ne pas publier via cet ancien projet Sites.

## Vérifications

```sh
node scripts/sync-content.mjs --check
node --check dist/site.js
node --check dist/app.js
node --check dist/gl.js
node --check dist/livraison.js
```

Les contrôles navigateur sont dans `scripts/verify.mjs`. Installer les outils à part si nécessaire (`npm install --prefix qa playwright`, puis `cd qa && npx playwright install chromium`). Lancer le serveur local, puis :

```sh
node scripts/verify.mjs
# Ou avec Chrome déjà installé sur macOS :
BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/verify.mjs
```

`BASE_URL` permet de tester un autre serveur. Le script vérifie :

- l’accueil à 320/390/768/1440 px : chargement des photos et polices, absence de débordement et de requêtes tierces, absence de traits rouges et de formulaire, filtres, galerie complète, visionneuse, clavier, balayage, liens WhatsApp préremplis, barre mobile, menu mobile, retour en haut ;
- la configuration de remplacement et un JSON indisponible ou invalide ;
- toutes les pages sans JavaScript (liens WhatsApp, e-mail, Instagram), puis chaque page intérieure à 4 largeurs (rendu, pied de page, liens internes) ;
- la livraison : générateur, refus d’un service inconnu ou d’un lien abîmé, page client, lien expiré, `noindex` ;
- les scènes WebGL sans loupe, et la réduction des animations.

Aucune application externe n’est réellement ouverte. Captures et rapport `qa/verification.json` restent ignorés par Git.
