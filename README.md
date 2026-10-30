# Madame Lia — site photographique

Site français en HTML, CSS et JavaScript natifs. Le dossier `dist/` est le site complet : aucune compilation, base de données, clé API ou installation nécessaire pour le consulter.

## Ouvrir en local

```sh
python3 -m http.server 4173 --directory dist
```

Ouvrir http://localhost:4173. Ne pas ouvrir directement index.html en file://.

## Reprendre sur l’autre ordinateur

Récupérer le dépôt `GGlamorosso/madame-lia-v1`, ouvrir le dossier avec Codex et lui transmettre :

> Lis AGENTS.md et README.md. Conserve le design actuel et le contact WhatsApp/e-mail. Intègre les vraies photos que je te fournis et les contenus validés de Lia. Modifie dist/services.json, synchronise le HTML avec node scripts/sync-content.mjs, vérifie le site sur mobile et ordinateur, puis accompagne-moi pour connecter ce dépôt à Vercel. Il reste la biographie, les réseaux exacts et les informations d’identification de Lia à recueillir. N’invente aucun de ces éléments. Une fois l’URL définitive connue, renseigne canonical, og:url et og:image avec cette adresse et une vraie photo.

## Modifier les photos

La source commune est `dist/services.json` :

- `images.hero` : couverture ; `images.aboutMain` et `images.aboutDetail` : présentation.
- `services[].photos` : les galeries des huit thèmes. Les mises en avant utilisent la première photo mariage et baptême.
- Chaque photo contient `src`, `alt`, `width`, `height`, `provisional` et éventuellement `srcset`.

Exemple de vraie photo (dimensions à adapter au fichier réel) :

```json
{
  "src": "assets/mariage-lia-01.jpg",
  "alt": "Description précise de la photographie",
  "width": 1600,
  "height": 1067,
  "provisional": false
}
```

Déposer les fichiers dans `dist/assets/`. Formats JPEG/JPG, PNG, WebP ; noms sans espaces ni accents, avec lettres, chiffres, tirets ou underscores. `srcset` est facultatif ; s’il est présent, chaque variante doit exister et indiquer sa largeur réelle (`assets/photo-small.webp 720w, assets/photo.webp 1600w`). Mettre des dimensions réelles et un texte alternatif descriptif. Optimiser les images avant intégration.

Après chaque modification de configuration (Node.js nécessaire uniquement pour cet outil de développement) :

```sh
node scripts/sync-content.mjs
node scripts/sync-content.mjs --check
```

Cette commande vérifie les chemins et actualise les images HTML, le préchargement et la copie de secours de la configuration. Le déploiement n’exécute aucune compilation. Les mentions provisoires suivent les photos affichées, y compris dans la visionneuse. Les variantes d’images restent facultatives. Un changement du nombre de thèmes demande aussi d’adapter les filtres et les options HTML.

## Contact et contenus restants

Dans `contact` : WhatsApp `33767220949`, e-mail `liapellegrin22@gmail.com`, réseaux `socials` (liste vide tant que les URL publiques exactes ne sont pas fournies). Pour modifier les coordonnées, mettre aussi à jour les liens HTML directs afin qu’ils fonctionnent sans JavaScript.

Le formulaire prépare le message dans WhatsApp ou l’application e-mail. Le visiteur confirme l’envoi. Aucun message n’est envoyé ni stocké par le site.

À terminer sur l’autre ordinateur :

- Vraies photos : couverture, deux images de présentation et galeries. Les images actuelles sont des ambiances générées, pas le travail de Lia.
- Biographie validée et comptes sociaux exacts, si souhaités.
- Identification de l’éditeur et informations d’hébergement dans les mentions : données réelles à fournir par Lia, sans invention.
- URL définitive : ajouter canonical, og:url et og:image absolus dans le head. Les anciennes URL ont été retirées.

## Vercel

Importer le dépôt GitHub dans Vercel avec **Root Directory = racine du dépôt**, **Framework Preset = Other**, **Output Directory = dist**. `vercel.json` fixe ces paramètres, sans commande d’installation ou de compilation. Aucune variable d’environnement nécessaire. Vercel se connecte sur l’autre ordinateur, après intégration des contenus.

L’ancien fichier `.openai/hosting.json` garde l’identité historique Sites ; il n’est pas utilisé par Vercel. Ne pas le déployer via Sites pour cette reprise.

## Vérifications

```sh
node scripts/sync-content.mjs --check
node --check dist/app.js
```

Pour les contrôles navigateur facultatifs, installer les outils de test à part (`npm install --prefix qa playwright` puis `cd qa` et `npx playwright install chromium`). Lancer le serveur local, puis `node scripts/verify.mjs`. `BASE_URL` permet de tester un autre serveur ; `BROWSER_PATH` permet d’utiliser un navigateur déjà installé. Les outils de test et les captures restent ignorés par Git.

Polices Cormorant Garamond et Manrope hébergées localement, licences SIL Open Font License conservées dans `dist/assets/`. `design/image-prompts.json` documente l’origine des visuels provisoires.
