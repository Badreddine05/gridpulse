# Données et conventions

## Source

Producteur : RTE. Jeu : `eco2mix-national-cons-def`, plateforme ODRÉ. L'API d'export v2.1 permet de sélectionner les champs et les instants. Le périmètre local va du 1er janvier 2023 au 31 décembre 2024, soit les bornes UTC `[2022-12-31T23:00:00Z, 2024-12-31T23:00:00Z[`.

Le manifeste enregistre l'URL exacte, l'heure de récupération, la taille et le SHA-256 des octets téléchargés. `--refresh` remplace uniquement le cache de ce projet et régénère ses sorties.

## Schéma

| Champ | Unité / convention |
|---|---|
| `timestamp` | Début d'heure en UTC |
| `date` | Date locale Europe/Paris, utilisée pour les regroupements |
| `consommation` | Moyenne de deux mesures demi-horaires, MW |
| `nucleaire`, `eolien`, `solaire`, `hydraulique`, `gaz`, `bioenergies`, `fioul`, `charbon` | Même agrégation, MW |
| `taux_co2` | Indicateur RTE d'émissions de production, gCO₂/kWh |
| `prediction`, `baseline`, `lower`, `upper` | MW, renseignés uniquement pour les heures de test admissibles |

Le JSON public encode les colonnes par position pour limiter sa taille ; leur ordre est explicite dans `meta.columns`. Le code `decodeData` restaure les noms, dates et heures.

## Contrôles

1. Vérifier que la réponse HTTP est un tableau JSON non vide.
2. Convertir les dates en instants UTC.
3. Pour un instant répété, vérifier l'égalité des mesures, y compris les valeurs absentes. Dédupliquer seulement si cette égalité tient ; sinon arrêter.
4. Rejeter une consommation négative ou nulle.
5. Regrouper par heure. Exiger deux valeurs pour chaque moyenne horaire, sans interpolation.
6. Réindexer implicitement l'axe horaire lors du `resample`, ce qui expose les heures manquantes.
7. Conserver les valeurs absentes en `null` dans le JSON et dans les formats analytiques.

La source actuelle contient quatre doublons au passage à l'heure d'été (deux en mars 2023, deux en mars 2024) avec des valeurs numériques identiques et des libellés locaux différents. Deux heures à l'automne sont absentes. Les journées locales peuvent donc contenir 23 ou 25 positions horaires, dont certaines sans mesure.

## Indicateurs

- **Consommation en TWh** : somme des puissances horaires valides / 1 000 000. Une puissance moyenne de 1 MW pendant une heure représente 1 MWh.
- **Pointe** : maximum des moyennes horaires, pas un maximum instantané.
- **Part renouvelable** : somme éolien + solaire + hydraulique + bioénergies, divisée par le total des huit filières, sur les lignes complètes.
- **Mix à une heure** : même dénominateur pour l'heure choisie. Le nucléaire fait partie du total, pas des renouvelables.
- **Intensité carbone mensuelle** : moyenne du taux RTE pondérée par la production totale horaire, uniquement lorsque production et taux sont disponibles.
- **Comparaison au mois précédent** : rapport entre les volumes mensuels, sans correction du nombre de jours ni de la météo. Cette comparaison est descriptive.

Il ne faut pas interpréter le mix comme le contenu exact de la consommation française : le pompage et les échanges transfrontaliers ne sont pas intégrés. Le taux de CO₂ n'est pas une analyse du cycle de vie des filières.

## Conservation

Le cache brut et les sorties Parquet/SQLite/CSV ne sont pas poussés dans Git. L'instantané JSON et le manifeste le sont : ils suffisent à faire fonctionner et tester le site. Aucun nom de consommateur, adresse, donnée privée ou secret n'est présent.
