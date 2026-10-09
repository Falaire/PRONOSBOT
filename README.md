# PoseTrace

PoseTrace transforme une vidéo locale en animation verticale directement dans le navigateur. Les vidéos, personnages, décors et pistes audio ne sont pas envoyés à un serveur.

## Fonctionnalités actuelles

- Import local MP4, WebM ou MOV avec glisser-déposer.
- Détection d'une personne par MediaPipe Pose Landmarker, exécuté côté navigateur (GPU puis repli CPU).
- **Cartoon dessiné** : corps articulé d'après les repères de pose, visage à contour, yeux, sourcils, cravate et bouche réagissant au niveau sonore.
- **Mes images** : personnage PNG transparent et décor image importés par l'utilisateur ; cadrage et taille du personnage suivent les repères détectés.
- Fond uni, vidéo recadrée, salle de classe dessinée en Canvas ou image de décor.
- Rendu Canvas 1080 × 1920 (9:16) et capture avec MediaRecorder. Le navigateur choisit WebM ou MP4 lorsqu'il le prend en charge ; WebM est généralement utilisé sous Chrome.
- La capture audio locale est incluse si le navigateur prend en charge la combinaison audio/vidéo MediaRecorder.

## Installation

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. Pour vérifier une compilation de production :

```bash
npm run build
npm start
```

Le moteur MediaPipe et son modèle sont téléchargés à la première analyse depuis jsDelivr et Google Storage. Aucun contenu utilisateur n'est envoyé à ces hôtes ; seuls les fichiers de bibliothèque et le modèle sont chargés.

## Utilisation

1. Importer une vidéo contenant une personne visible.
2. Choisir **Cartoon dessiné** ou **Mes images**.
3. En mode **Mes images**, fournir un PNG transparent du personnage ; le décor est facultatif.
4. Choisir un fond, ajuster le lissage et les dimensions visuelles, puis cliquer sur **Générer l'animation**.
5. Prévisualiser et télécharger le résultat.

## Limites actuelles — à lire avant usage

- Le modèle détecte une seule personne.
- Le mode **Mes images** déplace, redimensionne et incline légèrement le PNG entier. Un fichier PNG unique ne permet pas de plier les bras et les jambes séparément ; un rig articulé d'images découpées n'est pas encore pris en charge.
- La bouche du cartoon suit l'intensité sonore, pas encore les phonèmes ni les mots.
- La transcription Whisper, les sous-titres, la traduction anglaise et la conversion ffmpeg.wasm vers MP4 ne sont pas encore branchés à l'interface.
- L'export est en temps réel : une vidéo d'une minute prend environ une minute, et les longues vidéos peuvent utiliser beaucoup de mémoire.
- Le fonctionnement dépend du téléchargement initial du modèle MediaPipe et des capacités de l'appareil.
- La prise en charge de l'audio et du format MP4 dépend du navigateur ; le site affiche un statut si l'audio n'est pas supporté.

## Vercel

Projet Next.js compatible avec Vercel Hobby : commande de build `npm run build`, sortie Next.js automatique, Node 18 ou supérieur. Aucune variable d'environnement n'est nécessaire pour PoseTrace.

Le travail PoseTrace est développé sur la branche `arena/76ff3434-pronosbot`. Ne pas fusionner la PR PoseTrace dans `main` tant que le projet d'origine KickPredict utilise encore ce dépôt.
