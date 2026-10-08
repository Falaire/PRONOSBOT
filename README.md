# PoseTrace

PoseTrace transforme une vidéo locale en animation stickman, directement dans le navigateur. La vidéo originale n'est jamais envoyée à un serveur.

## Architecture

- **Next.js + TypeScript** : interface responsive déployable sur Vercel.
- **MediaPipe Pose Landmarker** : détection d'une personne côté client, avec modèle léger et accélération GPU.
- **Canvas HTML5** : dessin du squelette blanc sur fond configurable.
- **Filtre exponentiel** : lissage temporel et maintien de la dernière position fiable pendant les occlusions.
- **MediaRecorder** : export WebM lisible et téléchargeable.

## Installation

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. Pour une vérification de production :

```bash
npm run build
npm start
```

Le modèle MediaPipe est téléchargé au premier traitement depuis les CDN Google/jsDelivr ; l'application elle-même ne transmet aucune vidéo.

## Utilisation

1. Déposer un fichier MP4, WebM ou MOV (500 Mo maximum).
2. Régler couleur du trait, fond, épaisseur, taille de tête et lissage.
3. Cliquer sur **Générer le stickman**.
4. Prévisualiser puis télécharger le fichier WebM.

## Déploiement Vercel

Importer le dépôt dans Vercel. Les réglages par défaut Next.js suffisent : commande de build `npm run build`, sortie `.next`, Node 18 ou supérieur. Aucune variable d'environnement n'est nécessaire pour le MVP.

## Limites connues

- Le MVP suit une seule personne.
- La sortie est WebM ; la conversion MP4/ffmpeg.wasm et GIF sont prévues pour une phase ultérieure.
- Le traitement dépend des performances du navigateur et de la disponibilité du téléchargement du modèle MediaPipe.
- Les vidéos très longues ou haute résolution peuvent consommer beaucoup de mémoire ; un mode qualité réduite mobile est à ajouter.
- Le fond transparent est proposé dans l'interface, mais l'encodage MediaRecorder peut l'aplatir selon le navigateur.

## Déploiement

Le projet est configuré pour Vercel sur la branche `arena/76ff3434-pronosbot`.
