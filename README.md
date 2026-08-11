# Vidéothèque — MongoDB + espace admin discret

## Ce que fait ce projet

- **Page publique** : écran "Avez-vous 18 ans ou plus ?" avant tout accès, puis galerie de vidéos.
- **Espace admin** : accessible uniquement via un **chemin secret** que tu définis toi-même (voir `ADMIN_PATH` ci-dessous), protégé en plus par mot de passe. Permet d'uploader et supprimer des vidéos.
- **Stockage MongoDB** : les métadonnées (titre, description, date) sont stockées dans une collection MongoDB. Les fichiers vidéo eux-mêmes sont stockés via **GridFS**, le système de MongoDB pour les gros fichiers — donc plus aucun fichier sur le disque du serveur, et donc plus de perte de données au redémarrage sur Render.
- **Emplacements publicitaires AdSense** : déjà branchés dans `public/index.html`, il ne reste qu'à renseigner tes IDs de blocs.

## Installation

1. Installe les dépendances :
   ```bash
   npm install
   ```
2. Copie le fichier d'exemple :
   ```bash
   cp .env.example .env
   ```
3. Remplis `.env` :
   - `ADMIN_PASSWORD` : mot de passe de l'espace admin
   - `SESSION_SECRET` : longue chaîne aléatoire
   - `ADMIN_PATH` : un chemin difficile à deviner (ex: `x7k-panel-2p9`) — **change la valeur par défaut**, ne laisse jamais `admin`
   - `MONGODB_URI` : ton URI de connexion MongoDB (voir ci-dessous)
   - `PORT` : 3000 par défaut

4. Lance le serveur :
   ```bash
   npm start
   ```
5. Site public : `http://localhost:3000`
   Espace admin : `http://localhost:3000/<ta-valeur-ADMIN_PATH>/login.html`

## Créer une base MongoDB (Atlas, gratuit)

1. Va sur [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) et crée un compte.
2. Crée un cluster gratuit (M0).
3. Dans "Database Access", crée un utilisateur avec un mot de passe.
4. Dans "Network Access", autorise ton IP (ou `0.0.0.0/0` pour autoriser Render — moins strict mais nécessaire si Render n'a pas d'IP fixe sur le plan gratuit).
5. Clique sur "Connect" → "Drivers" et copie l'URI de connexion, du type :
   ```
   mongodb+srv://utilisateur:motdepasse@cluster0.xxxxx.mongodb.net/video-site
   ```
6. Colle cette URI dans `MONGODB_URI` (dans `.env` en local, ou dans les variables d'environnement de Render en production).

⚠️ Le plan gratuit Atlas (M0) est limité à 512 Mo de stockage — suffisant pour tester, mais tu devras passer à un plan payant si tu stockes beaucoup de vidéos.

## Déploiement sur Render

Dans les paramètres de ton service Render, section "Environment", ajoute les mêmes variables que dans `.env` : `ADMIN_PASSWORD`, `SESSION_SECRET`, `ADMIN_PATH`, `MONGODB_URI`. Ne mets jamais ton fichier `.env` directement dans le dépôt Git.

## Sur le chemin admin "discret"

Le principe : sans connaître `ADMIN_PATH`, personne ne peut même arriver sur l'écran de mot de passe. C'est une couche de protection supplémentaire, pas un remplacement du mot de passe — les deux protections restent actives en même temps. Quelques conseils :
- Ne partage ce chemin à personne, ne le mets dans aucun lien public.
- Change-le si tu soupçonnes qu'il a fuité.
- Le mot de passe admin reste ta protection principale : choisis-le long et unique.

## Structure du projet

```
video-site/
├── server.js              # Serveur Express (routes publiques + admin + MongoDB/GridFS)
├── package.json
├── .env.example
├── public/                 # Site public
│   ├── index.html
│   ├── css/style.css
│   └── js/main.js
└── admin/                  # Pages admin (servies sur le chemin secret ADMIN_PATH)
    ├── login.html
    ├── dashboard.html
    ├── css/admin.css
    └── js/
        ├── login.js
        └── dashboard.js
```
