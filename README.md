<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/readme/gridpulse-dark.png">
  <img alt="Application GridPulse : consommation et production d'électricité en France, avec indicateurs du mois et courbe horaire" src=".github/readme/gridpulse-light.png">
</picture>

# GridPulse

La consommation et la production d'électricité en France, heure par heure, sur 2023 et 2024, à partir des données publiques de RTE. GridPulse compare aussi une prévision à 24 heures à une référence simple, sur une période que le modèle n'a jamais vue.

**[Ouvrir l'application](https://badreddine05.github.io/gridpulse/)** · [Lire l'étude de cas](https://badreddine05.github.io/projets/gridpulse/) · [Source RTE](https://odre.opendatasoft.com/explore/dataset/eco2mix-national-cons-def/)

## Ce que l'on peut faire

L'application fonctionne sur un instantané historique embarqué : elle ne suit pas le réseau en direct, et elle n'a besoin ni de compte, ni de clé d'API, ni de serveur.

- Choisir une année et un mois, puis lire la consommation, la pointe, la part renouvelable et l'intensité carbone de la période.
- Parcourir une journée heure par heure, à l'heure de Paris, et la rejouer en animation ; le mix de production suit l'heure choisie.
- Cliquer dans le calendrier annuel pour retrouver une journée de pointe et sa courbe.
- Comparer, sur la période de test de novembre et décembre 2024, la consommation observée, la prévision et la référence.
- Exporter les données filtrées en CSV et consulter la provenance, les contrôles et les définitions.

## Ce que montrent les données

- Les pointes annuelles tombent en janvier, à 19 h : 83,3 GW le 23 janvier 2023 et 85,3 GW le 10 janvier 2024.
- Le nucléaire fournit 65 % de la production retenue en 2023 et 67 % en 2024.
- Sur 1 389 heures de test, le modèle commet une erreur absolue moyenne de 2 710 MW, contre 4 961 MW pour la référence (même heure, une semaine plus tôt), soit 45,4 % de moins.
- L'intervalle annoncé à 90 % ne contient que 47,37 % des observations de test. Il a été calibré sur septembre et octobre, des mois plus calmes que l'hiver ; ce défaut reste visible dans l'application.

| Indicateur sur le test | Gradient boosting | Référence |
| --- | ---: | ---: |
| MAE | 2 709,55 MW | 4 960,96 MW |
| RMSE | 3 539,45 MW | 5 742,04 MW |

Ce résultat porte sur un seul hiver et ne garantit rien pour une autre période.

## Lancer le projet

Il faut Node.js 22.12 ou plus récent. L'instantané public est versionné : Python n'est pas nécessaire pour ouvrir le site.

```sh
npm ci
npm run dev
```

Ouvrez l'adresse affichée par Vite, en général `http://127.0.0.1:5174`. Pour la version de production :

```sh
npm test
npm run build
npm run preview
```

`dist/` est un site statique, compatible avec GitHub Pages et les sous-chemins (`base: './'`). Une image Docker sert le site avec Nginx :

```sh
docker build -t gridpulse .
docker run --rm -p 8080:80 gridpulse
```

## Reproduire les données et le modèle

Il faut Python 3.13. La source compte environ 35 000 observations demi-horaires ; le fichier brut et les sorties Parquet et SQLite restent hors de Git.

```sh
python -m venv .venv
. .venv/bin/activate        # Windows PowerShell : .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python pipeline/build_dataset.py
python -m pytest tests/test_pipeline.py -q
```

Le pipeline réutilise le cache `data/raw/rte-2023-2024.json` ; `--refresh` force un nouveau téléchargement. Une nouvelle version de la source peut changer l'empreinte et les résultats, ce que le manifeste permet de repérer.

| Sortie | Contenu |
| --- | --- |
| `data/processed/electricity_hourly.parquet` | Table horaire typée |
| `data/processed/gridpulse.sqlite` | Table et vues SQL journalières, mensuelles et d'erreurs |
| `data/processed/electricity_hourly.csv` | Export complet |
| `data/manifest.json` | Provenance, empreinte SHA-256, contrôles et métriques |
| `public/data/gridpulse.json` | Données compactes servies par l'application |

## Pour les développeurs

Les calculs lourds restent en Python et en SQL. Le navigateur ne réentraîne aucun modèle : il filtre les mesures, recalcule les agrégats et affiche les prévisions déjà calculées.

| Chemin | Rôle |
| --- | --- |
| `pipeline/build_dataset.py` | Collecte, validation, stockage et prévision |
| `sql/analytics.sql` | Vues analytiques documentées |
| `src/data.mjs` | Calculs et transformations côté interface |
| `src/main.jsx`, `src/style.css` | Interface React et graphiques SVG |
| `tests/` | Invariants métier et tests contre les fuites de données futures |
| `docs/` | [Conventions de données](docs/DATA.md) et [fiche du modèle](docs/MODEL.md) |

Les tests Python vérifient l'intégration des MW en MWh, le traitement des doublons contradictoires et des valeurs absentes, la séparation temporelle et l'absence d'observation future dans les variables. Les tests JavaScript vérifient les agrégats, la pondération carbone, l'export CSV et le calendrier. GitHub Actions les exécute avec le build à chaque push.

## Qualité et limites des données

- 35 088 lignes source, 35 084 instants distincts et 17 544 heures dans la série finale.
- Quatre doublons du changement d'heure de printemps ne sont retirés que si toutes leurs mesures sont identiques ; une contradiction arrête le traitement.
- Deux heures manquantes à l'automne restent vides : la variable à prévoir n'est jamais interpolée.
- L'intensité carbone est celle de la production, selon la méthode RTE. Les échanges internationaux et le pompage sont exclus du mix présenté.
- Le modèle suppose chaque mesure disponible dès la fin de son heure ; les délais réels de publication ne sont pas simulés.

## Données, licences et crédits

Données : RTE, éCO2mix national consolidé et définitif, via ODRÉ, sous [Licence Ouverte Etalab 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/). Code sous licence [MIT](LICENSE). Polices Newsreader, IBM Plex Sans et IBM Plex Mono (SIL OFL 1.1), dont les licences sont dans [`public/licenses/`](public/licenses/) ; autres composants dans [THIRD_PARTY.md](THIRD_PARTY.md).

Projet personnel de [Badreddine Channoufi](https://badreddine05.github.io/), réalisé avec l'aide d'outils d'IA. Les années 2023 et 2024 désignent les données, pas la date de réalisation du projet.

## In English

GridPulse is a browser observatory of French electricity demand and generation in 2023 and 2024, built on RTE open data. A Python pipeline checks and stores the data in Parquet and SQLite and trains a 24-hour forecast, evaluated chronologically on eight weeks it never saw. On that test the model cuts the mean absolute error of a seasonal baseline by 45.4 %, while its 90 % interval only covers 47 % of observations, a weakness the app shows openly.
