# PoseTrace — validation et architecture V1

## 1. Décision d'architecture

La voie vectorielle conserve l’approche **pose → suivi → retargeting → rendu déterministe**. À la demande de l’utilisateur, une seconde voie vidéo-à-vidéo distante inspirée d’Open-Generative-AI est ajoutée comme option séparée, pas comme remplacement silencieux du rendu vectoriel. Elle permet d’essayer une transformation de style, mais elle est générative et ne garantit ni l’identité, ni l’absence de scintillement, ni la sortie 9:16.

La proposition mélange toutefois plusieurs niveaux ambitieux : suivi/ré-identification, génération vidéo distante, reconstruction de décor et attribution audio-visuelle du locuteur. On les garde séparés et on les valide par étapes.

| Besoin | V1 recommandée | À différer | Pourquoi |
|---|---|---|---|
| 2 personnes | Pose Landmarker configuré pour 2 poses + association de pistes par centre prédit | YOLO + BoT-SORT + OSNet | Suffisant pour valider le rendu ; l'association peut échouer quand les personnes se croisent ou se masquent. |
| Pose | Landmarks MediaPipe sur les deux personnes | RTMPose/ViTPose en cascade | Une seule famille de modèle et une seule runtime à déployer côté navigateur. |
| Décor | Fond papier clair, puis quelques décors vectoriels fixes choisis par l'utilisateur | Grounding DINO + SAM 2 + image FLUX/SDXL par plan + RAFT | Le fond presque vide de la référence évite la majorité du coût et du risque de scintillement. |
| Expression | Quelques expressions vectorielles pilotées par Face Landmarker/blendshapes | Reconnaissance d'émotion libre | Les blendshapes sont des mesures, pas une compréhension fiable de l'émotion. |
| Locuteur | Dans un premier temps, audio global pour la bouche et sous-titres Whisper | TalkNet + pyannote + séparation de voix | « Qui parle » exige l'alignement audio-visuel, pas seulement la transcription ou la diarisation audio. |
| Accessoires | Variante stable par ID, puis choix manuel (lunettes, cheveux, foulard, micro) | Classification automatique de tous les attributs | Une confirmation de l'utilisateur est plus fiable qu'une fausse certitude visuelle. |
| Export local | Même timeline PTS pour image et audio ; WebM d'abord | MP4 universel immédiatement | MP4/H.264 et AAC ne sont pas pris en charge uniformément dans les navigateurs. |
| Génération V2V distante | Adaptateur MuAPI isolé, un modèle de style à la fois, devis/solde avant upload | Générer les frames localement ou appeler tout le catalogue de 600+ modèles | Le média quitte l’appareil; coût, conservation, ratio et cohérence dépendent du fournisseur. |

### Confidentialité, fournisseur et budget

La contrainte initiale était zéro téléversement et zéro API payante. L’utilisateur a ensuite explicitement choisi d’ajouter un flux vidéo-à-vidéo distant avec la source vidéo/audio envoyée à MuAPI, tout en limitant son usage aux crédits gratuits. Le mode local reste le défaut et continue de traiter la vidéo sans upload.

Le mode MuAPI est une exception explicite : l’utilisateur fournit sa propre clé dans l’interface; elle reste en mémoire de la page et les requêtes partent directement du navigateur à `api.muapi.ai`. PoseTrace/Vercel ne reçoivent ni la clé ni la vidéo. Avant l’envoi, l’interface demande consentement, affiche l’estimation et le solde; si devis, solde, devise ou vérification échouent, elle s’arrête. Le devis est revérifié avant upload et doit correspondre à celui qui a été examiné.

La case « crédits gratuits seulement » n’est pas un verrou de facturation du fournisseur. Pour respecter l’intention, utiliser un compte sans paiement automatique ni solde payant; MuAPI reste l’autorité sur les crédits, la rétention et la facturation. Le code MIT du studio amont ne rend pas ses modèles/API gratuits. Aucun appel MuAPI live n’a été fait ni validé avec une clé. Aucun GPU server, worker Vercel ou stockage PoseTrace n’est ajouté.

## 2. Architecture technique V1

### Flux

```text
Pipeline local (défaut)
  File vidéo local → HTMLVideoElement / PTS
  → MediaPipe Pose (jusqu’à 2) → Track ID / lissage / prédiction courte
  → retargeting stable → Canvas 1080×1920, papier + cartoons/accessoires
  → MediaRecorder local → aperçu et téléchargement

Pipeline V2V (choix explicite)
  Clé saisie en mémoire + modèle/prompt + consentement + compte crédits gratuits
  → devis + solde (aucun média envoyé) → revue du devis
  → revalidation → téléversement vidéo/audio directement vers MuAPI
  → tâche V2V et polling → aperçu de l’URL retournée par le fournisseur
```

Dans le pipeline local, le modèle fournit des mesures et le moteur vectoriel dessine chaque personnage à toutes les frames. Dans le pipeline distant, le fournisseur reçoit le clip comme une entrée unique : le tracker MediaPipe local n’y participe pas et il n’existe pas de garantie d’un ID stable par personne. Le fournisseur génère la vidéo; son rendu peut varier et n’a pas la même garantie de géométrie ou de temporalité.

### Contrats de données

Les positions sont normalisées par rapport à l'image source (`0..1`), et les temps sont des microsecondes PTS de la vidéo — pas un compteur d'images supposant 30 fps.

```json
{
  "schemaVersion": 1,
  "source": {
    "width": 1920,
    "height": 1080,
    "fps": { "num": 30000, "den": 1001 },
    "durationUs": 12500000
  },
  "shots": [{ "id": 0, "startUs": 0, "endUs": 12500000 }],
  "frames": [
    {
      "ptsUs": 33367,
      "shotId": 0,
      "tracks": [
        {
          "id": "shot0-person1",
          "bbox": [0.08, 0.06, 0.45, 0.96],
          "root": [0.27, 0.51],
          "confidence": 0.91,
          "occluded": false,
          "keypoints": [
            { "name": "nose", "x": 0.28, "y": 0.17, "score": 0.95 },
            { "name": "left_shoulder", "x": 0.22, "y": 0.31, "score": 0.89 }
          ],
          "face": { "expression": "neutral", "jawOpen": 0.14 },
          "appearance": { "hair": "short", "beard": false, "glasses": true, "scarf": null },
          "speaker": null
        }
      ]
    }
  ],
  "subtitles": [{ "startUs": 300000, "endUs": 890000, "text": "Bonjour.", "speakerId": null }]
}
```

Pour le prototype, les landmarks peuvent rester en objets TypeScript. Pour des clips longs, un gros JSON par frame consomme inutilement de la mémoire : on passera à des tableaux typés compacts (`Float32Array` pour les points, entier pour le PTS), et l'on ne gardera pas les pixels vidéo en mémoire.

### Composants et responsabilités

1. **Ingestion** : valider conteneur, taille/durée, dimensions et piste audio ; garder le `File` local.
2. **Analyse** : exécuter la pose sur des frames horodatées. Les scènes coupées réinitialisent au minimum les pistes provisoires.
3. **Tracking** : chaque détection contient un centre racine (milieu épaules/hanches). Associer globalement les centres prédits, conserver l'ID en cas d'inversion de l'ordre du modèle et faire expirer une piste après une courte fenêtre d'occultation.
4. **Animation** : filtre One Euro ou Kalman sur les articulations ; si quelques frames manquent, prédire puis interpoler. Une coupure de plan ne doit pas interpoler entre deux scènes.
5. **Apparence** : apparence persistante par `trackId`. V1 donne des variantes stables ou permet un choix manuel ; la détection automatique de barbe/cheveux/lunettes n'est pas supposée fiable sans validation.
6. **Rendu** : Canvas/PixiJS dessine une scène complète à chaque frame depuis un état stable ; il ne fait aucune inférence.
7. **Audio/export** : garder les PTS, produire des frames à la cadence cible et remuxer la piste audio d'origine à partir du même zéro temporel.

## 3. Structure proposée

```text
app/
  page.tsx                               # route, monte le studio
features/posetrace/
  PoseTraceStudio.tsx                    # orchestrateur client
  models.ts                              # catalogue V2V ciblé
  components/
    RemoteGenerationPanel.tsx            # clé, consentements, prompt, devis
  providers/
    muapi.ts                             # balance, estimation, upload, job, polling
lib/tracking/
  pose-tracker.ts                        # association prototype de 2 pistes
lib/rendering/
  pose-renderer.ts                       # retargeting et dessin vectoriel
lib/vision/
  types.ts                               # contrats de sous-titres
lib/export/
  ffmpeg-exporter.ts                     # conversion locale MP4, pas encore branchée
hooks/
  useWhisper.ts                          # ASR local, pas encore intégré à l’UI
  useTranslation.ts                      # NLLB local, pas encore intégré à l’UI
tests/
  muapi.test.ts                          # garde-fous devis/solde/consentement
  pose-tracker.test.ts
  pose-renderer.test.ts
docs/
  posetrace-v1-architecture.md
```

Cette séparation reprend la logique studio / catalogue / adaptateur fournisseur visible dans le projet lié, sans reprendre son grand workspace ni fusionner les dépôts. `PoseTraceStudio` reste encore l’orchestrateur principal; une prochaine extraction pourra séparer ingestion, aperçu, réglages et export en composants/hooks dédiés.

## 4. Plan de développement et critères de passage

### Étape 0 — deux studios pilotes (intégrés, validation média en attente)

- Studio local : détecter au plus deux corps avec MediaPipe, associer les poses aux IDs même si l’ordre de sortie s’inverse, puis retargeter sur papier clair avec échelle fixe et transitions de scène adoucies.
- Varier les IDs par accessoires de démonstration; rejeter proprement le cas « aucun corps détecté ».
- Studio V2V facultatif : intégrer le modèle `runway-aleph-v2v`, un adaptateur MuAPI et un contrôle préalable coût/solde. Le devis est vérifié sans fichier; la vidéo n’est envoyée qu’après les deux consentements, une revue du devis et sa revalidation.
- Valider la détection locale sur des vidéos réelles et tester la compatibilité réelle du devis MuAPI avec une clé de l’utilisateur avant d’activer ce flux en Preview public.

**Limite du prototype :** un suivi au centre prédit n'est pas un vrai modèle de ré-identification. Les croisements et occultations longues peuvent encore échanger ou recréer une piste.

### V1.1 — mouvement sans saut

- Ajouter filtre One Euro configurable et interpolation temporelle bornée.
- Pré-analyser les poses avant le rendu final, afin de verrouiller le cadrage sur les deux personnes et ne pas déplacer la caméra pendant le clip.
- Ajouter détection de coupe ; vider/réinitialiser les pistes entre plans.
- Critère : ID stable sur les clips simples à 2 personnes ; au-delà d'une courte occultation, signaler la perte plutôt que prétendre reconnaître avec certitude.

### V1.2 — expressions et finition

- Face Landmarker multi-visage : yeux, sourcils, bouche/traits de visage → quelques expressions vectorielles.
- Palette de pièces graphiques : cheveux, lunettes, barbe, chapeau, foulard ; sélection par personne et persistance par ID.
- Détection/édition de sous-titres ; afficher la parole dans des bulles.
- Micro : dans un premier temps placement manuel ; la détection d'objet puis le rattachement à la main sont des étapes séparées.

### V1.3 — export fiable

- Analyser les frames avec leurs PTS, lisser/retargeter, rendre à 30 fps ou à la cadence source définie.
- Mesurer durée, début/fin audio et dérive ; remuxer l'audio original sans le réencoder quand possible.
- MP4 en option uniquement si le codec est supporté et testé ; WebM comme repli explicite.
- Tester les longues vidéos, le manque de mémoire, Safari/iOS et l'onglet en arrière-plan.

### V2/V3

- 3 personnes ou plus, meilleur suivi/re-identification et intervenant actif.
- Bibliothèque de décors vectoriels puis mouvement de caméra ; image générée une fois par plan uniquement si l'utilisateur choisit une voie serveur locale/assumée.
- Éditeur pour corriger à la main les ID, accessoires, sous-titres et points de pose ratés.

## 5. Difficultés et risques

- MediaPipe `numPoses: 2` est un prototype pratique, pas un tracker d'identité. Il ne renvoie pas d'identifiant persistent et ses résultats peuvent changer d'ordre.
- Un tracker géométrique peut confondre deux personnes qui se croisent, se cachent ou sortent du cadre. La ré-identification après coupe demande des indices d'apparence supplémentaires et reste probabiliste.
- La voie V2V téléverse le clip complet chez MuAPI après consentement. Un modèle génératif peut changer le visage, le nombre apparent de personnes, le mouvement, la durée, l’audio ou le ratio; il ne remplace pas la promesse du rendu vectoriel stable.
- Le devis/solde MuAPI est contrôlé, mais le code ne peut pas imposer la facturation du fournisseur. Aucun appel réel n’a validé le format de réponse ou l’accès au modèle; en cas de réponse non reconnue, l’adaptateur bloque avant upload.
- Pose 2D ne déduit pas toujours l'orientation 3D, la profondeur ni la position correcte des mains. Une pose stickman de face à partir d'un profil est une convention graphique, pas une reconstruction exacte.
- Les expressions blendshapes ne disent pas avec certitude « sceptique » ou « sarcastique » ; ces émotions doivent être choisies par règles prudentes ou corrigées par l'utilisateur.
- Transcription Whisper ne dit pas à elle seule quel visage parle. TalkNet/Light-ASD et pyannote sont des modèles distincts, lourds et plus risqués dans un navigateur.
- Le décor détecté puis remplacé peut perdre la perspective et les ombres. Un fond vide est beaucoup plus stable pour la V1.
- `MediaRecorder` capture généralement en temps réel, ne donne pas toujours un contrôle frame-exact du PTS et n'offre pas H.264/AAC partout. La synchronisation stricte demande un pipeline d'export testé par navigateur.
- Les modèles et bibliothèques ont leurs licences propres ; vérifier leur usage commercial avant publication. L'utilisateur doit disposer des droits sur sa vidéo et les images qu'il importe.
- Aucun déploiement ne doit être promu en production avant le test de l'aperçu avec les clips réels (2 personnes, personnes qui se croisent, plan coupé, mauvaise lumière).
