# Développer et reconstruire GridPulse

## Application

Il faut Node.js 22.12 ou plus récent (ou 24) et npm. L'instantané public est versionné : Python n'est pas nécessaire pour ouvrir le site.

```sh
npm ci
npm run dev
```

Vite affiche l'adresse locale, en général `http://127.0.0.1:5174`. Pour vérifier la version de production :

```sh
npm test
npm run build
npm run preview
```

`dist/` est un site statique, compatible avec GitHub Pages et les sous-chemins grâce à `base: './'`. Arrêter le serveur Vite avant un `npm ci` : sous Windows, il verrouille `esbuild.exe`.

Une image Docker sert l'application compilée avec Nginx ; le pipeline Python reste une étape de préparation distincte.

```sh
docker build -t gridpulse .
docker run --rm -p 8080:80 gridpulse
```

## Données et modèle

Il faut Python 3.13. Le téléchargement contient environ 35 000 observations ; le fichier brut et les sorties Parquet et SQLite restent hors de Git.

```sh
python -m venv .venv
# Linux/macOS
. .venv/bin/activate
# Windows PowerShell : .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python pipeline/build_dataset.py
python -m pytest tests/test_pipeline.py -q
```

Le pipeline réutilise le cache `data/raw/rte-2023-2024.json`. L'option `--refresh` force un nouveau téléchargement. Une nouvelle version de la source peut changer l'empreinte et les résultats : le manifeste permet de le repérer.

| Sortie | Contenu |
| --- | --- |
| `data/processed/electricity_hourly.parquet` | Table horaire typée |
| `data/processed/gridpulse.sqlite` | Table et vues SQL journalières, mensuelles et d'erreurs |
| `data/processed/electricity_hourly.csv` | Export complet |
| `data/manifest.json` | Provenance, empreinte SHA-256, contrôles et métriques |
| `public/data/gridpulse.json` | Données compactes servies par l'application |

Le calcul reste en Python et en SQL. Le navigateur ne réentraîne aucun modèle : il filtre les mesures, recalcule les agrégats et affiche les prévisions déjà calculées.

## Organisation du code

| Chemin | Rôle |
| --- | --- |
| `pipeline/build_dataset.py` | Collecte, validation, stockage et prévision |
| `sql/analytics.sql` | Vues analytiques documentées |
| `src/data.mjs` | Calculs et transformations côté interface |
| `src/main.jsx`, `src/style.css`, `src/tokens.css` | Interface React, graphiques SVG et identité graphique |
| `tests/` | Invariants métier et tests contre les fuites de données futures |
| `public/data/`, `data/manifest.json` | Instantané public et traçabilité du fichier source |

## Tests

Les tests Python vérifient l'intégration des MW en MWh, le traitement des doublons contradictoires et des valeurs absentes, la séparation temporelle et l'absence d'observation future dans les variables. Les tests JavaScript vérifient les agrégats, la pondération carbone, l'export CSV, le calendrier et la cohérence de l'instantané. GitHub Actions les exécute avec le build à chaque push et pull request.

## Qualité des données

- 35 088 lignes source, 35 084 instants distincts et 17 544 heures dans l'axe temporel.
- Quatre doublons du changement d'heure de printemps ne sont retirés que si toutes leurs mesures sont identiques ; des valeurs contradictoires arrêtent le traitement.
- Deux heures manquantes à l'automne restent vides. La cible n'est jamais interpolée, et les variables retardées propagent ces exclusions dans la calibration et le test.
- Une moyenne horaire n'est produite que si ses deux mesures demi-horaires existent, pour chaque variable.

Voir aussi les [conventions de données](DATA.md) et la [fiche du modèle](MODEL.md).
