# PoseTrace Studio

PoseTrace Studio transforme une vidéo en animation de deux façons : un rendu vectoriel local déterministe, ou un mode vidéo-à-vidéo distant via MuAPI. La structure sépare la page Next.js, le studio, son catalogue de modèles et ses adaptateurs de fournisseurs pour préparer une intégration dans un studio multi-outils tel que [Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI).

## Deux pipelines

### Studio vectoriel local — mode par défaut

- Import local MP4, WebM ou MOV; aucune vidéo, image ou piste audio n’est téléversée.
- MediaPipe Pose détecte jusqu’à deux personnes; `PoseTrackManager` associe les détections aux IDs, lisse la pose et prédit brièvement les occultations.
- Rendu Canvas 1080 × 1920 (9:16), papier clair et traits sombres; variantes foulard/lunettes par ID.
- Capture à 30 fps par `MediaRecorder`; codecs et audio dépendent du navigateur.

### Studio vidéo-à-vidéo MuAPI — mode distant optionnel

- Modèle V2V `runway-aleph-v2v` et consigne de transformation, avec ratio 9:16 demandé.
- La clé MuAPI est saisie dans l’interface et gardée uniquement en mémoire pendant la session; elle n’est pas envoyée au serveur PoseTrace/Vercel.
- Le bouton de préflight vérifie d’abord le devis et le solde, **sans téléverser la vidéo**. Il faut ensuite lire le devis, autoriser l’envoi vidéo/audio et confirmer l’usage d’un compte à crédits gratuits avant de pouvoir lancer le téléversement.
- Le média est envoyé directement de l’appareil à MuAPI. Si le devis, le solde ou leurs devises sont illisibles, le traitement s’arrête avant l’upload. Le fichier distant est limité à 100 Mo.
- Ce chemin n’utilise pas le tracker local à deux personnes : le modèle traite la vidéo entière comme une seule entrée. Il est génératif; fidélité des personnes, audio de sortie, ratio, résolution et stabilité temporelle ne sont pas garantis comme dans le rendu vectoriel.

**La confirmation « crédits gratuits » n’est pas une garantie de facturation de MuAPI.** Utiliser un compte sans paiement automatique ni solde payant; le fournisseur reste responsable du solde et des règles de facturation. Ne jamais coller une clé dans un message ou la committer.

## Architecture

```text
app/page.tsx                              # route Next.js, très mince
features/posetrace/PoseTraceStudio.tsx    # orchestrateur du studio et pipeline local
features/posetrace/components/            # panneaux du studio
features/posetrace/models.ts              # catalogue V2V ciblé
features/posetrace/providers/muapi.ts     # devis, solde, upload, génération et polling
lib/tracking/pose-tracker.ts              # suivi local de deux pistes
lib/rendering/pose-renderer.ts             # retargeting et dessin Canvas
```

Le code est organisé en adaptateur fournisseur + studio pour faciliter un portage ultérieur. Cette branche prépare une intégration, mais **ne modifie pas le dépôt amont Open-Generative-AI** et n’en importe pas sa grande base de code.

## Lancer et vérifier

```bash
npm ci
npm run dev
npm test
npm run build
```

Le premier usage local télécharge MediaPipe/WASM et le modèle de pose depuis leurs CDN. Seuls les modèles nécessaires au navigateur sont chargés; la vidéo utilisateur reste locale dans le mode vectoriel.

## Limites

- Le tracker local n’est pas une ré-identification : croisements, occultations longues, sorties de cadre et changements de plan peuvent échanger ou recréer un ID.
- Les accessoires automatiques sont assignés par ID, pas reconnus sur les personnes filmées.
- Le PNG personnalisé du mode local est un sprite complet, pas un rig articulé.
- Le V2V MuAPI reçoit la vidéo entière, audio inclus; stockage, conservation et effacement dépendent du fournisseur. Le préflight et la compatibilité réelle de l’API n’ont pas été validés avec une clé MuAPI, aucun appel live n’a été fait.
- MediaRecorder en local capture en temps réel; l’alignement exact des PTS et de l’audio reste à valider sur des vidéos réelles.

L’analyse de l’architecture cible, des formats de données et des étapes se trouve dans [`docs/posetrace-v1-architecture.md`](docs/posetrace-v1-architecture.md).
