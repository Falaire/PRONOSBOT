# Architecture v2 — Plateforme de pronostics football (sources gratuites)

> Document de conception. Il ne remplace pas encore l'application actuelle (Next.js + Supabase + moteur TypeScript).
> Les points marqués **[À VÉRIFIER]** demandent une confirmation (licence ou tarif) avant mise en production.

---

## 0. Points bloquants à lire en premier

| Sujet | Constat | Conséquence |
|---|---|---|
| **football-data.co.uk** | Le site indique des données « gratuites mais destinées aux particuliers », et **interdit l'usage commercial et les produits d'entraînement de modèles par bots, scrapers ou IA**. | Source **non utilisable** pour un site payant, ni pour entraîner le modèle commercial. Option : licence payante ou remplacement. |
| **StatsBomb Open Data** | Conditions d'usage de l'éditeur, en général non commerciales avec attribution **[À VÉRIFIER dans le README du dépôt]**. | Utilisable en R&D uniquement tant que la licence n'est pas confirmée. Pas de xG en production sans accord. |
| **Club Elo** | API publique gratuite (`api.clubelo.com`). Conditions commerciales non explicites **[À VÉRIFIER auprès de clubelo.com]**. | Acceptable pour une V1 si l'accord est confirmé ; sinon, Elo maison calculé à partir des résultats. |
| **openfootball, martj42/international_results** | Données publiées sous licence ouverte (CC0 généralement) **[À VÉRIFIER sur chaque dépôt]**. | Sources sûres pour la base commerciale. |
| **Vercel Hobby** | Les conditions Vercel limitent le plan Hobby à un **usage personnel non commercial**. Un site qui encaisse des paiements doit passer en **Pro (≈ 20 $/mois par membre)**. | Le hosting frontend « gratuit » ne tient pas pour un produit commercial. |
| **Railway / Render / Fly.io** | Railway n'a plus de plan gratuit (essai unique de 5 $). Fly.io n'offre plus de gratuité aux nouveaux comptes. Render propose un plan gratuit qui se met en veille après 15 min et dont la base gratuite expire après 30 jours. | Pour un backend 24/7, budget minimal d'environ 7 $/mois. Ne pas héberger la base sur un plan gratuit expirant. |

**Budget réaliste d'un produit commercial : environ 30 $/mois** (Vercel Pro ≈ 20 $, API ≈ 7 $, base et Redis en plan gratuit si les limites suffisent). Un usage 100 % gratuit n'est possible que pour un prototype non commercial.

---

## 1. Vue d'ensemble

### 1.1 Principe directeur

**Les pronostics sont calculés en batch et stockés. L'API ne fait que lire.** Une prédiction Dixon-Coles est une matrice 11×11 : son calcul prend quelques millisecondes. Le temps de réponse est donc dominé par le réseau et la base, pas par le modèle. Cela rend l'objectif de moins de 300 ms facile à tenir, y compris en cache froid.

### 1.2 Diagramme des couches

```
┌────────────────────────── SOURCES (gratuites, voir §2.1) ──────────────────────────┐
│ openfootball   Club Elo   international_results   [football-data*]   [StatsBomb*]   │
└───────────────┬──────────────────────────────────────────────────────────────────────┘
                │  GitHub Actions (cron 05:00 UTC = 05:00 Lomé)
┌───────────────▼──────── COUCHE DONNÉES (Python, packages/ml) ───────────────────────┐
│ ingest → normaliser (alias d'équipes) → valider → upsert Postgres                   │
│ build_features (point-in-time) → table features (versionnée)                        │
└───────────────┬──────────────────────────────────────────────────────────────────────┘
                │
┌───────────────▼──────── POSTGRES (Supabase / Neon) ─────────────────────────────────┐
│ matches · teams · match_odds · team_elo · features · models · predictions ·          │
│ prediction_results · (vues de performance)                                           │
└───────┬─────────────────────────────────────────────┬────────────────────────────────┘
        │ predict (quotidien)                          │ retrain (hebdo)
┌───────▼─────────────────────┐          ┌─────────────▼───────────────────────────────┐
│ predictions (matrice,        │          │ Dixon-Coles (MLE) + LightGBM → ensemble →  │
│ 1X2, O/U, BTTS, score)       │◄─────────│ calibration → évaluation walk-forward →    │
│ modèle actif uniquement      │  active  │ promotion si meilleur (table models)       │
└───────┬─────────────────────┘          └─────────────────────────────────────────────┘
        │
┌───────▼──────── API FASTAPI (apps/api) ─────────────────────────────────────────────┐
│ lecture seule · Redis (cache) · rate limiting · OpenAPI                               │
└───────┬──────────────────────────────────────────────────────────────────────────────┘
        │ HTTPS (server-side fetch, jamais depuis le navigateur vers localhost)
┌───────▼──────── FRONTEND NEXT.JS 15 (apps/web) ─────────────────────────────────────┐
│ App Router · RSC + ISR · shadcn/ui · Tailwind · Vercel Edge/CDN                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

\* Sources non utilisables commercialement sans licence (voir §0).

---

## 2. Couche Données

### 2.1 Sources

| Source | Contenu | Format | Licence / conditions | Usage autorisé | Fréquence |
|---|---|---|---|---|---|
| **openfootball** (`football.json`) | Résultats, calendriers, nombreuses ligues | JSON / TXT | Ouverte (CC0) **[À VÉRIFIER]** | Commercial après vérification | Quotidienne |
| **international_results** (martj42) | Matchs internationaux depuis 1872, tirs au but, buteurs | CSV | Ouverte (CC0) **[À VÉRIFIER]** | Commercial après vérification | Hebdomadaire |
| **Club Elo** (`api.clubelo.com`) | Elo quotidien par club, historique complet | CSV | Gratuit, conditions à confirmer **[À VÉRIFIER]** | V1 si accord | Quotidienne (1 appel / jour : `/YYYY-MM-DD`) |
| **football-data.co.uk** | Résultats, stats de match (tirs, corners, cartons), cotes d'ouverture et de clôture | CSV | **Usage personnel uniquement** (site) | **Interdit en commercial** ; R&D interne seulement si validé | Hebdomadaire (site mis à jour ~2 fois / semaine) |
| **StatsBomb Open Data** | Événements, xG par tir, sur un sous-ensemble de compétitions | JSON | Conditions de l'éditeur **[À VÉRIFIER]** | R&D ; commercial à confirmer | Hebdomadaire |

**Option de remplacement payant pour les cotes et stats** : TheStatsAPI indique que ses données peuvent servir à des applications commerciales, à partir de 39 £/mois, avec essai de 7 jours **[À VÉRIFIER : tarifs et conditions au moment de l'achat]**.

**Sources exclues** : scraping de FBref, Understat ou Transfermarkt sans accord des éditeurs. Leurs conditions interdisent en général la réutilisation commerciale.

### 2.2 Pipeline d'ingestion

| Étape | Détail |
|---|---|
| 1. Extraction | Un module par source (`ingest/openfootball.py`, `clubelo.py`, `intl.py`, `football_data.py`, `statsbomb.py`). Chaque module écrit un fichier brut horodaté dans `raw/<source>/<date>.<ext>`. |
| 2. Normalisation | Noms d'équipes ramenés à un `team_id` interne via `team_aliases(source, alias, team_id)`. Dates converties en UTC. Scores en entiers. |
| 3. Validation | Schéma (pydantic), bornes (buts 0–20), cohérence (`FTR` = résultat calculé à partir des buts), doublons, variation anormale du nombre de matchs. Un échec bloque la publication et ouvre une alerte. |
| 4. Chargement | Upsert idempotent sur `matches.source_key` (`source:league:date:home:away`). |
| 5. Cotes | Cotes d'ouverture et de clôture dans `match_odds` (une ligne par bookmaker, marché et sélection). |
| 6. Journal | Table `ingestion_runs` : source, nombre de lignes lues, insérées, rejetées, durée, erreur. |

Fréquences : openfootball et Club Elo chaque jour à 05:00 UTC ; football-data et StatsBomb chaque mardi et vendredi ; international_results chaque semaine.

### 2.3 Feature store

Les features sont calculées **à la date du coup d'envoi** : seules les informations antérieures sont utilisées. C'est la condition pour éviter la fuite de données (*leakage*) pendant l'entraînement.

| Famille | Feature | Calcul | Source |
|---|---|---|---|
| Force | `att_i`, `def_i` (Dixon-Coles) | Estimés par maximum de vraisemblance pondéré dans le temps, par ligue | Résultats |
| Force | `elo_diff` | Elo domicile − Elo extérieur, à la veille du match | Club Elo |
| Forme | `pts_ewma_5`, `gd_ewma_5` | Moyenne exponentielle (α = 0,3) des points et de la différence de buts | Résultats |
| Forme | `form_home`, `form_away` | Même calcul, limité aux matchs à domicile / à l'extérieur | Résultats |
| Repos | `rest_days_home/away` | Jours depuis le dernier match | Résultats |
| Charge | `matches_14d_home/away` | Nombre de matchs sur 14 jours | Résultats |
| Confrontations | `h2h_home_winrate` (lissé) | (victoires + 1) / (matchs + 3), avec un a priori neutre | Résultats |
| Contexte | `promoted_home/away`, `season_progress` | Équipe promue ; part de saison jouée | Calendrier |
| xG (V2) | `xg_for_ewma`, `xg_against_ewma` | EWMA des xG sur les 10 derniers matchs | StatsBomb (sous licence) |
| Marché (V2) | `p_market_home/draw/away` | Probabilités dé-marginées à partir des cotes d'ouverture (pas de clôture en production) | Cotes (sous licence) |

Stockage :
- **Postgres** : table `features` (une ligne par match et par `feature_set_version`, colonnes en `jsonb` plus les colonnes clés typées).
- **Parquet** : snapshot figé par version dans un bucket (Supabase Storage). Il sert à l'entraînement et à la reproductibilité.

### 2.4 Schéma de base de données (principal)

```sql
-- Référentiel
CREATE TABLE sources (
  id           text PRIMARY KEY,           -- 'openfootball', 'clubelo', ...
  licence      text NOT NULL,
  commercial_ok boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz
);

CREATE TABLE competitions (
  id        bigserial PRIMARY KEY,
  code      text UNIQUE NOT NULL,          -- 'FR1', 'PL', 'CAF_CL'
  name      text NOT NULL,
  country   text,
  avg_goals_per_team numeric(4,2)          -- calculé, voir §3.2
);

CREATE TABLE teams (
  id              bigserial PRIMARY KEY,
  canonical_name  text NOT NULL,
  country         text,
  clubelo_name    text                      -- clé de jointure Club Elo
);

CREATE TABLE team_aliases (
  source   text REFERENCES sources(id),
  alias    text NOT NULL,
  team_id  bigint REFERENCES teams(id),
  PRIMARY KEY (source, alias)
);

-- Matchs et résultats
CREATE TABLE matches (
  id            bigserial PRIMARY KEY,
  source_key    text UNIQUE NOT NULL,
  competition_id bigint REFERENCES competitions(id),
  season        text NOT NULL,
  kickoff_utc   timestamptz NOT NULL,
  home_team_id  bigint REFERENCES teams(id),
  away_team_id  bigint REFERENCES teams(id),
  status        text NOT NULL CHECK (status IN ('scheduled','finished','postponed','cancelled')),
  home_goals    smallint, away_goals smallint,
  ht_home_goals smallint, ht_away_goals smallint,
  source        text REFERENCES sources(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX matches_kickoff_idx ON matches (kickoff_utc);
CREATE INDEX matches_status_idx  ON matches (status, kickoff_utc);

CREATE TABLE match_odds (
  match_id   bigint REFERENCES matches(id) ON DELETE CASCADE,
  bookmaker  text NOT NULL,
  market     text NOT NULL,                -- '1X2', 'OU25', 'BTTS'
  selection  text NOT NULL,                -- '1','X','2','over','under','yes','no'
  odds       numeric(7,3) NOT NULL,
  is_closing boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL,
  PRIMARY KEY (match_id, bookmaker, market, selection, is_closing)
);

CREATE TABLE team_elo (
  team_id bigint REFERENCES teams(id),
  on_date date NOT NULL,
  elo     numeric(7,2) NOT NULL,
  PRIMARY KEY (team_id, on_date)
);

-- Features et modèles
CREATE TABLE features (
  match_id           bigint REFERENCES matches(id) ON DELETE CASCADE,
  feature_set_version text NOT NULL,
  payload            jsonb NOT NULL,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, feature_set_version)
);

CREATE TABLE models (
  id              bigserial PRIMARY KEY,
  name            text NOT NULL,           -- 'dc', 'lgbm', 'ensemble_v1'
  version         text NOT NULL,
  trained_until   timestamptz NOT NULL,    -- borne temporelle : aucune donnée postérieure
  params          jsonb NOT NULL,
  metrics         jsonb NOT NULL,          -- logloss, brier, rps, ece par marché
  artifact_uri    text,                    -- chemin de l'artefact joblib
  artifact_sha256 text,
  is_active       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
-- Un seul modèle actif à la fois
CREATE UNIQUE INDEX models_one_active ON models (is_active) WHERE is_active;

-- Sorties et performance (transparence)
CREATE TABLE predictions (
  id             bigserial PRIMARY KEY,
  match_id       bigint REFERENCES matches(id) ON DELETE CASCADE,
  model_id       bigint REFERENCES models(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  p_home numeric(5,4), p_draw numeric(5,4), p_away numeric(5,4),
  p_over25 numeric(5,4), p_btts numeric(5,4),
  lambda_home numeric(5,3), lambda_away numeric(5,3),
  top_scores jsonb NOT NULL,              -- [{"h":1,"a":0,"p":0.12}, ...] top 10
  confidence smallint,
  explanation text,
  data_gaps  text[],
  UNIQUE (match_id, model_id)             -- ancienne prédiction conservée par version
);

CREATE TABLE prediction_results (
  prediction_id bigint PRIMARY KEY REFERENCES predictions(id) ON DELETE CASCADE,
  evaluated_at  timestamptz NOT NULL DEFAULT now(),
  logloss_1x2   numeric(7,5), brier_1x2 numeric(7,5), rps numeric(7,5),
  hit_1x2       boolean, hit_exact_score boolean,
  hit_ou25      boolean, hit_btts boolean
);

CREATE INDEX predictions_model_idx ON predictions (model_id, created_at);
```

Vue de performance (exemple) :

```sql
CREATE VIEW v_model_performance_daily AS
SELECT m.name || ':' || m.version AS model,
       date_trunc('day', mt.kickoff_utc) AS day,
       count(*)                          AS n,
       avg(r.logloss_1x2)                AS logloss_1x2,
       avg(r.brier_1x2)                  AS brier_1x2,
       avg(r.rps)                        AS rps,
       avg(r.hit_1x2::int)               AS acc_1x2,
       avg(r.hit_exact_score::int)       AS acc_score
FROM prediction_results r
JOIN predictions p ON p.id = r.prediction_id
JOIN models m      ON m.id = p.model_id
JOIN matches mt    ON mt.id = p.match_id
GROUP BY 1, 2;
```

### 2.5 Décisions de conception sur les données

- **Pas de règle de troncature par ancienneté** : on garde les matchs à venir en priorité (leçon de l'incident de synchronisation déjà corrigé dans `lib/fixture-selection.ts`).
- **Historique versionné** : une prédiction n'est jamais écrasée. Chaque version de modèle garde ses propres lignes. C'est ce qui rend l'historique de performance fiable.
- **Borne temporelle par modèle** (`trained_until`) : un modèle ne voit jamais de données postérieures à sa date d'entraînement.

---

## 3. Couche Modèle de prédiction

### 3.1 Approche recommandée : ensemble à trois étages

```
Étage 1 — Dixon-Coles (Poisson bivarié corrigé)   → λ_dom, λ_ext → matrice de scores
Étage 2 — LightGBM (multiclasse 1X2, binaires O/U et BTTS)
            entrées : features §2.3 + λ et probabilités Dixon-Coles
Étage 3 — Ensemble pondéré puis calibration (isotone ou Platt par marché)
```

Pourquoi cette combinaison :
- **Dixon-Coles** est le modèle de référence du football. Il donne une matrice de scores cohérente : 1X2, O/U, BTTS et score exact en découlent tous. C'est la seule façon propre d'obtenir le score exact.
- **LightGBM** capte des interactions que Dixon-Coles ignore (repos, charge, contexte). Il est entraîné à partir des sorties de Dixon-Coles, calculées **hors échantillon** pour éviter la fuite.
- **Calibration** : une probabilité de 60 % doit se réaliser environ 60 % du temps. Sans cette étape, les probabilités des GBM sont souvent mal calibrées.

### 3.2 Dixon-Coles : cœur du calcul

Modèle : `buts_dom ~ Poisson(λ)`, `buts_ext ~ Poisson(μ)`, avec
`λ = att_dom · def_ext · γ · exp(...)` et `μ = att_ext · def_dom`, où `γ` est l'avantage du terrain.

Correction de Dixon-Coles sur les petits scores (τ), appliquée uniquement sur (0,0), (0,1), (1,0), (1,1) :

```python
# packages/ml/pronos_ml/models/dixon_coles.py  (extrait)
import numpy as np
from scipy.stats import poisson

def tau(x: int, y: int, lam: float, mu: float, rho: float) -> float:
    if x == 0 and y == 0: return 1 - lam * mu * rho
    if x == 0 and y == 1: return 1 + lam * rho
    if x == 1 and y == 0: return 1 + mu * rho
    if x == 1 and y == 1: return 1 - rho
    return 1.0

def score_matrix(lam: float, mu: float, rho: float, max_goals: int = 10) -> np.ndarray:
    k = np.arange(max_goals + 1)
    M = np.outer(poisson.pmf(k, lam), poisson.pmf(k, mu))
    M[0, 0] *= 1 - lam * mu * rho
    M[0, 1] *= 1 + lam * rho
    M[1, 0] *= 1 + mu * rho
    M[1, 1] *= 1 - rho
    return M / M.sum()          # renormalisation après troncature

def p_1x2(M: np.ndarray) -> tuple[float, float, float]:
    home = np.tril(M, -1).sum()   # lignes > colonnes
    draw = np.trace(M)
    away = np.triu(M, 1).sum()
    return home, draw, away
```

Estimation : maximum de vraisemblance **pondéré dans le temps** : chaque match pèse `exp(-ξ · jours_écoulés)`. `ξ` se calibre par validation (plage usuelle d'environ 0,001 à 0,005 par jour **[à valider sur vos données]**). Optimisation avec `scipy.optimize.minimize` (L-BFGS-B), par ligue, une fois par semaine.

Contraintes : moyenne des `att` égale à 1, `γ` et `ρ` libres, `ρ` borné dans `[-0,3 ; 0]`.

Moyenne de buts par équipe : **attention au piège de la valeur par défaut**. Le schéma actuel de PRONOSBOT initialise `avg_goals_per_match` à 2,50, valeur qui correspond au total de buts d'un match et non à la moyenne par équipe. Il faut la calculer à partir des données : `total de buts / 2 / nombre de matchs`, par ligue et par saison.

### 3.3 LightGBM et ensemble

- Trois modèles : multiclasse (1X2), binaire (O/U 2,5), binaire (BTTS).
- Entraînement **walk-forward** : fenêtres d'entraînement successives par saison, validation sur la saison suivante. Aucun mélange aléatoire.
- Hyperparamètres : recherche bayésienne légère (Optuna), limitée à 50 essais.
- Ensemble : `p = w·p_DC + (1−w)·p_LGBM`, avec `w` choisi pour minimiser le log-loss de validation.

### 3.4 Calibration

| Marché | Méthode | Données de calibration |
|---|---|---|
| 1X2 | Température sur les logits, ou isotone un-contre-tous puis renormalisation | Dernière saison de validation |
| O/U 2,5, BTTS | Platt (régression logistique) ou isotone | Idem |
| Score exact | Pas de calibration séparée : la matrice Dixon-Coles est déjà normalisée. On vérifie seulement la calibration des probabilités marginales. | — |

Implémentation : `sklearn.calibration` (CalibratedClassifierCV avec un estimateur figé, `FrozenEstimator` depuis scikit-learn 1.6 **[vérifier la version installée]**).

### 3.5 Pipeline d'entraînement et de réentraînement

| Job | Fréquence | Étapes |
|---|---|---|
| `predict_daily` | Chaque jour 06:00 UTC | Charge le modèle actif, calcule les prédictions des matchs des 7 prochains jours, les écrit dans `predictions`. Dès qu'une cote d'ouverture arrive, la prédiction est recalculée (sans changer de version). |
| `grade_daily` | Chaque jour 07:00 UTC | Pour chaque match terminé, calcule les métriques et écrit `prediction_results`. |
| `retrain_weekly` | Dimanche 03:00 UTC | Snapshot des features → Dixon-Coles → LightGBM → ensemble → calibration → évaluation walk-forward → comparaison au modèle actif. |

**Règle de promotion** : un nouveau modèle devient actif seulement si son RPS (*Ranked Probability Score*) de validation est meilleur que celui du modèle actif, avec un gain minimal de 0,002, et s'il passe les tests de calibration (ECE < 0,03 sur chaque marché). Sinon, l'ancien reste actif et l'échec est journalisé.

### 3.6 Stockage des modèles

- Artefacts `joblib` dans un bucket privé (Supabase Storage), nommés `name/version.joblib`, avec leur empreinte SHA-256 enregistrée dans `models`.
- Au démarrage de l'API, le modèle actif est téléchargé et son empreinte vérifiée.
- **MLflow n'est pas recommandé en MVP** : la table `models` et les fichiers JSON de métriques suffisent. À reconsidérer à partir de la V2.
- **Prefect non nécessaire** : quatre tâches planifiées avec GitHub Actions couvrent le besoin.

### 3.7 Évaluation

| Métrique | Pourquoi | Référence de comparaison |
|---|---|---|
| **Log-loss** (1X2, O/U, BTTS) | Pénalise fortement les probabilités trop confiantes et fausses | Modèle « fréquences moyennes » et Elo seul |
| **Brier** (multiclasse) | Erreur quadratique, facile à lire | Idem |
| **RPS** (*Ranked Probability Score*) | Tient compte de l'ordre des issues (victoire domicile > nul > extérieur) | Idem |
| **ECE** et diagramme de fiabilité | Vérifie que « 60 % » se réalise à 60 % | Diagonale parfaite |
| **Précision** 1X2 | Lisible pour le public | Issue la plus fréquente (environ 45–47 % à domicile) |
| **Score exact** | Mesuré à titre informatif : c'est un résultat très difficile à prédire | Score le plus fréquent |

Le meilleur benchmark reste les **cotes de clôture dé-marginées**. Si le modèle ne les bat pas en log-loss, la valeur ajoutée est limitée. Ce benchmark nécessite une source de cotes sous licence (§2.1).

---

## 4. Couche API (FastAPI)

### 4.1 Endpoints

| Méthode | Route | Description | Cache |
|---|---|---|---|
| GET | `/v1/health` | État de l'API, version du modèle actif | Aucun |
| GET | `/v1/competitions` | Liste des compétitions | 24 h |
| GET | `/v1/matches?date=&competition=&status=` | Matchs filtrés (`upcoming`, `finished`) | 5 min |
| GET | `/v1/matches/{id}` | Détail d'un match : équipes, forme, H2H, Elo | 5 min |
| GET | `/v1/matches/{id}/prediction?model=active` | Probabilités, top 10 scores, explication, manques de données | 10 min, jusqu'au coup d'envoi |
| GET | `/v1/predictions/upcoming?days=2` | Pronostics des prochains matchs | 15 min |
| GET | `/v1/performance?model=&from=&to=` | Métriques journalières et cumulées | 1 h |
| GET | `/v1/performance/calibration?market=1x2&model=` | Données du diagramme de fiabilité (10 classes) | 1 h |
| GET | `/v1/teams/{id}` | Équipe, Elo, forces `att/def` | 1 h |
| GET | `/v1/competitions/{code}/table` | Classement calculé à partir des matchs | 15 min |
| POST | `/v1/admin/ingest` | Déclenche une ingestion (jeton admin) | — |
| POST | `/v1/admin/retrain` | Déclenche un réentraînement (jeton admin) | — |

### 4.2 Schémas de réponse (extrait)

```python
# apps/api/app/schemas/prediction.py
from pydantic import BaseModel, Field

class ScoreProb(BaseModel):
    h: int = Field(ge=0, le=10)
    a: int = Field(ge=0, le=10)
    p: float = Field(ge=0, le=1)

class PredictionOut(BaseModel):
    match_id: int
    model: str                     # 'ensemble_v1'
    model_version: str
    created_at: str
    p_home: float; p_draw: float; p_away: float
    p_over25: float; p_btts: float
    top_scores: list[ScoreProb]
    confidence: int = Field(ge=0, le=100)
    explanation: str
    data_gaps: list[str]
```

### 4.3 Exemple de route

```python
# apps/api/app/routers/predictions.py
from fastapi import APIRouter, Depends, HTTPException
from app.cache import Cache, get_cache
from app.repo import Repo, get_repo
from app.schemas.prediction import PredictionOut

router = APIRouter(prefix="/v1", tags=["predictions"])

@router.get("/matches/{match_id}/prediction", response_model=PredictionOut)
async def get_prediction(
    match_id: int,
    model: str = "active",
    cache: Cache = Depends(get_cache),
    repo: Repo = Depends(get_repo),
):
    key = f"pred:{match_id}:{model}"
    if (hit := await cache.get_json(key)) is not None:
        return hit
    row = await repo.prediction(match_id, model)
    if row is None:
        raise HTTPException(status_code=404, detail="Pronostic indisponible pour ce match")
    await cache.set_json(key, row, ttl_seconds=600)
    return row
```

### 4.4 Authentification

- **Lecture publique** : pas d'authentification pour les pronostics. C'est le modèle de la page publique et du SEO.
- **Clé API optionnelle** (`X-API-Key`) pour un usage programmatique, avec quota par clé, stockée hachée (SHA-256).
- **Comptes utilisateurs** (sauvegarde de pronostics, historique personnel) : Supabase Auth, jeton JWT vérifié par FastAPI. À ajouter en V1 seulement si le besoin est confirmé.
- **Routes admin** : jeton statique en variable d'environnement, comparé en temps constant (`hmac.compare_digest`).

### 4.5 Gestion des erreurs et rate limiting

| Situation | Code | Réponse |
|---|---|---|
| Match ou prédiction inconnu | 404 | Problème JSON (RFC 9457) : `type`, `title`, `status`, `detail` |
| Paramètre invalide | 422 | Erreurs pydantic |
| Modèle actif non chargé | 503 | `Retry-After: 60` |
| Quota dépassé | 429 | `Retry-After` et en-têtes `RateLimit-*` |
| Erreur interne | 500 | Message générique. Détail uniquement dans les logs (Sentry, plan gratuit). |

Rate limiting : `slowapi` avec backend Redis. Par défaut 60 requêtes par minute et par IP sur les routes publiques, 600 par minute et par clé API.

### 4.6 Stratégie de cache Redis

| Clé | Contenu | TTL |
|---|---|---|
| `pred:{match_id}:{model}` | Prédiction sérialisée | Jusqu'au coup d'envoi (max 10 min) |
| `upcoming:{date}:{days}` | Liste des pronostics | 15 min |
| `perf:{model}:{from}:{to}` | Métriques | 1 h |
| `ratelimit:*` | Compteurs (géré par slowapi) | Fenêtre de la règle |

Invalidation : après chaque `predict_daily` et `retrain_weekly`, les préfixes `pred:*` et `upcoming:*` sont supprimés. Côté Next.js, un webhook déclenche la revalidation des pages concernées.

En-têtes HTTP : `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` sur les routes de lecture, et `ETag` pour éviter de renvoyer des corps identiques.

**Redis gratuit** : Upstash propose un plan gratuit à quotas journaliers **[À VÉRIFIER : limites actuelles]**. Pour une V1 à faible trafic, le cache mémoire de l'API est suffisant ; Redis devient utile quand il y a plusieurs instances.

### 4.7 Budget de latence (cible < 300 ms)

| Étape | Cible p95 |
|---|---|
| Réseau client → edge Vercel (cache ISR) | 20–60 ms |
| Edge → API (même région que la base) | 20–50 ms |
| Lecture Redis | < 2 ms |
| Lecture Postgres (index sur `match_id`) | 5–20 ms |
| Calcul Dixon-Coles à la demande (si pas de prédiction stockée) | 1–5 ms |
| Sérialisation | < 5 ms |
| **Total, cache froid** | **< 150 ms** |

---

## 5. Couche Frontend (Next.js 15)

### 5.1 Structure des pages

| Route | Rendu | Contenu |
|---|---|---|
| `/` | ISR (5 min) | Pronostics du jour, KPI du modèle (précision 30 jours, log-loss), explication courte |
| `/matchs` | ISR (5 min) | Liste par date et compétition, filtres (`searchParams`) |
| `/matchs/[id]` | ISR (60 s), `dynamicParams` | Probabilités, matrice de scores (heatmap), forme, H2H, Elo, explication, données manquantes |
| `/historique` | ISR (1 h) | Performance par jour et cumulée, diagramme de fiabilité, tableau par marché |
| `/classements/[code]` | ISR (15 min) | Classement de la ligue |
| `/equipes/[id]` | ISR (1 h) | Historique Elo (sparkline), forces att/def |
| `/methodologie` | Statique | Sources et licences, modèle, limites, avertissement jeu responsable |
| `/api` | Statique | Lien vers la documentation OpenAPI |

Pages statiques générées au build : les 50 prochains matchs (`generateStaticParams`). Les autres sont générées à la demande et mises en cache.

### 5.2 Composants clés (shadcn/ui + Tailwind)

| Composant | Rôle | Base shadcn |
|---|---|---|
| `MatchCard` | Résumé d'un match et de ses probabilités | Card, Badge |
| `ProbabilityBar` | Barre 1 / X / 2 empilée, accessible (aria-label) | — |
| `ScoreHeatmap` | Matrice 0–5 × 0–5 colorée | Tooltip |
| `CalibrationChart` | Diagramme de fiabilité (chargé dynamiquement) | — |
| `PerformanceTable` | Tableau trié et filtrable | Table, Select |
| `DataGapsNotice` | Affiche les données manquantes, sans les inventer | Alert |
| `ModelBadge` | Nom et version du modèle, date de la prédiction | Badge |
| `ResponsibleGamblingFooter` | Avertissement 18+ et jeu responsable | — |

### 5.3 Data fetching

- **Par défaut : composants serveur**, appel direct à l'API via `fetch` avec `next: { revalidate }`. Pas de fetch côté navigateur pour les données publiques.
- **Client (SWR ou TanStack Query)** : uniquement pour les filtres interactifs et les rafraîchissements en direct. Une seule source de vérité, l'API.
- **Variable d'environnement** : `API_BASE_URL` côté serveur. Le navigateur ne doit jamais appeler `localhost` ni l'API directement sans proxy.
- **Streaming** : `<Suspense>` autour de la matrice de scores et des statistiques de match, pour afficher la prédiction sans attendre le reste.
- **Graphiques** : Recharts, chargé avec `next/dynamic` pour ne pas alourdir la page d'accueil.

### 5.4 Performance

- Rendu serveur et ISR : la plupart des pages sont servies depuis le cache de l'edge.
- Images : `next/image` pour les logos d'équipes, mises en cache.
- Budget JavaScript : moins de 120 Ko compressés par page de liste.
- SEO : `metadata` par page, `sitemap.ts` (matchs à venir), données structurées `SportsEvent` sur les pages de match.
- Accessibilité : contrastes vérifiés, probabilités lisibles sans couleur seule (texte à côté des barres).

---

## 6. Flux complets

### 6.1 Génération et affichage d'un pronostic

```
Navigateur ──GET /matchs/123──► Vercel Edge
                                  │ cache ISR valide ? ──oui──► HTML (≈ 50 ms)
                                  │ non
                                  ▼
                        Next.js (RSC, serveur)
                                  │ fetch API_BASE_URL/v1/matches/123 + /prediction
                                  ▼
                        FastAPI : cache Redis ──hit──► JSON
                                  │ miss
                                  ▼
                        Postgres : predictions WHERE match_id=123 AND model=active
                                  │ absent ? → calcul Dixon-Coles à la demande (1–5 ms)
                                  ▼
                        JSON + Cache-Control s-maxage=300
                                  │
                                  ▼
                        Rendu HTML, cache ISR, affichage
```

### 6.2 Ingestion, prédiction et évaluation

```
05:00 UTC  ingest_daily ──► raw/ ──► validate ──► upsert matches, team_elo, match_odds
                                                        │
06:00 UTC  build_features ──► features (version courante)
           predict_daily  ──► predictions (modèle actif, 7 jours)
                                                        │
07:00 UTC  grade_daily ──► prediction_results (matchs terminés)
                                                        │
           webhook ──► invalidation Redis + revalidation Next.js
```

### 6.3 Réentraînement hebdomadaire

```
Dimanche 03:00 UTC
  snapshot features (parquet, horodaté)
  → Dixon-Coles (MLE pondéré) par ligue
  → features DC hors échantillon → LightGBM (walk-forward)
  → ensemble (poids par log-loss) → calibration (dernière saison)
  → évaluation : log-loss, Brier, RPS, ECE par marché
  → si RPS_nouveau < RPS_actif − 0,002 et ECE < 0,03 :
        insérer models (is_active = true, ancien → false), uploader l'artefact
     sinon : journaliser l'échec, garder l'actif
```

### 6.4 Déploiement

```
Pull request
  → CI (GitHub Actions) : ruff + pytest (apps/api, packages/ml), tsc, eslint, next build,
    test de fumée du backtest sur un petit jeu figé
  → merge sur main
  → deploy-api : build Docker → Render ou Fly.io (plan payant minimal)
  → deploy-web : Vercel (projet Pro)
  → migrations SQL : Supabase CLI, appliquées avant le déploiement de l'API
```

---

## 7. Structure du dépôt (monorepo recommandé)

```
pronosbot/
├─ apps/
│  ├─ web/                       # Next.js 15 (App Router, TS, Tailwind, shadcn/ui)
│  │  ├─ app/
│  │  ├─ components/
│  │  └─ lib/api.ts              # client typé généré depuis OpenAPI
│  └─ api/                       # FastAPI
│     ├─ app/
│     │  ├─ main.py
│     │  ├─ routers/             # predictions.py, matches.py, performance.py, admin.py
│     │  ├─ schemas/             # pydantic
│     │  ├─ repo.py              # accès Postgres (asyncpg ou SQLAlchemy 2)
│     │  ├─ cache.py             # Redis / mémoire
│     │  └─ config.py            # pydantic-settings
│     ├─ tests/
│     └─ Dockerfile
├─ packages/
│  ├─ ml/                        # paquet Python : ingestion, features, modèles, évaluation
│  │  ├─ pronos_ml/
│  │  │  ├─ ingest/              # openfootball.py, clubelo.py, intl.py, football_data.py, statsbomb.py
│  │  │  ├─ features/            # elo.py, form.py, rest.py, h2h.py, build.py
│  │  │  ├─ models/              # dixon_coles.py, gbm.py, ensemble.py, calibration.py
│  │  │  └─ eval/                # metrics.py, walk_forward.py, reports.py
│  │  ├─ tests/
│  │  └─ pyproject.toml
│  └─ shared/                    # types TS générés (openapi-typescript)
├─ jobs/                         # points d'entrée CLI : ingest_daily.py, predict.py, retrain.py, grade.py
├─ db/migrations/                # SQL versionné
├─ docs/                         # architecture, licences, méthodologie
├─ data/                         # gitignored : cache local des bruts et parquet
└─ .github/workflows/            # ci.yml, ingest-daily.yml, retrain-weekly.yml, deploy-api.yml
```

Gestion : `npm` (workspaces) pour le monorepo TypeScript, comme le dépôt actuel (`package-lock.json`) ; `uv` ou `pip-tools` pour Python. Un fichier `.env.example` par application, **sans valeurs réelles**.

---

## 8. Stratégie de performance et de scalabilité

| Levier | Mise en œuvre | Effet |
|---|---|---|
| Pré-calcul | Prédictions stockées par batch, jamais calculées pendant une requête utilisateur | Latence constante |
| ISR et cache edge | `revalidate` par type de page | Plus de 90 % des requêtes servies sans l'API (objectif) |
| Cache Redis | Clés par match et par modèle, invalidation après batch | Lecture < 2 ms |
| Index Postgres | `matches(kickoff_utc)`, `predictions(match_id, model_id)` | Requêtes en quelques ms |
| Pool de connexions | PgBouncer (fourni par Supabase) ou pool asyncpg | Évite l'épuisement des connexions |
| Séparation lecture / écriture | L'API lit ; seuls les jobs écrivent | Pas de contention |
| Horizontal | API sans état : plusieurs instances derrière le load balancer de la plateforme | Montée en charge simple |
| Données chaudes | Seules les saisons récentes et les 7 prochains jours sont dans les tables « chaudes » ; l'historique complet reste en Parquet | Base sous les limites du plan gratuit |

Limites à surveiller : la limite de stockage du plan gratuit Supabase, et la mise en pause du projet gratuit après inactivité **[À VÉRIFIER : conditions actuelles]**.

---

## 9. Points de démarrage concrets

### 9.1 Ce qui existe déjà dans PRONOSBOT

| Brique | État actuel | Réutilisation |
|---|---|---|
| Frontend Next.js 15 + Tailwind + composants UI | Présent | **Garder** ; migrer vers `apps/web` plus tard, pas au départ |
| Base Supabase (Postgres) | Présente (`fixtures`, `teams`, `predictions`, `leagues`) | **Garder** ; ajouter les tables §2.4 par migration |
| Moteur Elo + Poisson + Dixon-Coles | Présent en TypeScript (`lib/prediction/engine.ts`) | **Garder** comme référence et test de non-régression |
| Jobs cron Vercel (sync, ratings, generate) | Présents | Migrer progressivement vers GitHub Actions + `packages/ml` |
| Sources | API-Football (clé payante) | À conserver pour le temps réel si l'abonnement le permet |

### 9.2 Ce qu'il faut créer

| Élément | Source de départ | Remarque |
|---|---|---|
| Paquet `pronos_ml` | Écriture propre | Éviter de copier du code GPL sans vérifier la licence |
| Dixon-Coles Python | Implémentation maison (§3.2) | Valider contre le moteur TypeScript existant |
| Ingestion Club Elo | Requête `api.clubelo.com/YYYY-MM-DD` | Confirmer les conditions d'usage |
| API FastAPI | Squelette maison, FastAPI + pydantic-settings | Pas de gabarit obligatoire |

Bibliothèques à évaluer avant d'intégrer du code :
- `penaltyblog` : Dixon-Coles, Elo, scrapers **[licence à vérifier avant copie]**
- `socceraction` : traitement StatsBomb (MIT **[à vérifier]**)
- `soccerdata` : scraping (Apache-2.0 **[à vérifier]**), mais attention aux conditions des sites scrapés

Référence scientifique : Dixon & Coles (1997), *Modelling Association Football Scores and Inefficiencies in the Football Betting Market* ; Constantinou & Fenton (2012) pour le RPS.

### 9.3 Ordre de développement

**MVP (2 à 3 semaines)**
1. Migrations SQL §2.4 et ingestion openfootball + Club Elo.
2. Dixon-Coles Python, validé contre le moteur TypeScript sur quelques matchs.
3. Job `predict_daily` et table `predictions` versionnée.
4. API : `/matches`, `/matches/{id}/prediction`, `/health`.
5. Pages Next.js : accueil, liste des matchs, détail d'un match, méthodologie.
6. Évaluation simple : log-loss et précision 1X2 sur les matchs terminés.

**V1 (4 à 6 semaines)**
1. LightGBM, ensemble, calibration et diagrammes de fiabilité.
2. Walk-forward complet, règle de promotion, `retrain_weekly`.
3. Page historique, classements, pages équipes.
4. Cache Redis, rate limiting, documentation OpenAPI publique.
5. Monitoring : Sentry (plan gratuit), alertes sur les échecs d'ingestion.

**V2**
1. Features xG et marché, uniquement après confirmation des licences.
2. Clés API, comptes utilisateurs, sauvegarde de pronostics.
3. Mode « shadow » : nouveau modèle calculé en parallèle, sans être publié, pour comparaison.
4. Détection de dérive (PSI sur les features), alertes automatiques.

---

## 10. Risques et précautions

| Risque | Mitigation |
|---|---|
| Usage commercial de données non autorisé | Registre des sources (`sources.commercial_ok`) ; seules les sources validées alimentent la production |
| Surconfiance affichée au public | Afficher l'incertitude, la version du modèle et les données manquantes ; ne jamais présenter un pronostic comme une garantie |
| Cadre légal des jeux d'argent | Vérifier la réglementation applicable au Togo et dans les pays ciblés avant de publier des conseils de paris |
| Dépendance à un fournisseur gratuit | Ingestion idempotente ; données brutes archivées ; possibilité de changer de source sans toucher au modèle |
| Fuite de données dans l'entraînement | Features calculées à la date du coup d'envoi ; walk-forward ; `trained_until` vérifié à l'entraînement |
| Secrets dans le dépôt | `.env.example` sans valeurs réelles ; secrets dans GitHub Actions et Vercel uniquement |

---

*Dernière mise à jour : 2026-10-11. Tarifs et conditions à revérifier avant chaque décision d'achat ou de déploiement.*
