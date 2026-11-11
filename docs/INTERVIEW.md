# Présenter GridPulse en entretien

## Démonstration de trois minutes

1. Ouvrir la vue d'ensemble et expliquer qu'il s'agit d'un instantané RTE 2023–2024.
2. Changer le mois. Montrer la consommation, la pointe et le mix ; préciser la différence entre MW et MWh.
3. Lancer une journée puis mettre en pause : la courbe et la composition de production suivent l'heure choisie.
4. Cliquer sur une pointe du calendrier pour retrouver sa journée.
5. Ouvrir Prévisions, comparer le modèle et la référence, puis montrer **aussi** la couverture insuffisante de l'intervalle.
6. Terminer dans Données & méthode : provenance, doublons de changement d'heure, valeurs absentes et pipeline reproductible.

## Ce que le projet permet d'expliquer

**Qualité des données.** Une source officielle nécessite encore des contrôles. Les doublons observés au passage à l'heure d'été ne sont supprimés qu'après comparaison des mesures. Des données contradictoires bloqueraient le pipeline.

**Séries temporelles.** Un découpage aléatoire mélangerait passé et futur. Les trois fenêtres temporelles séparent ajustement du modèle, calibration de l'intervalle et évaluation finale.

**Fuite subtile.** Une moyenne horaire étiquetée par son début n'est connue qu'à sa fin. Un retard de 24 heures serait trop récent pour une prévision strictement à 24 heures. Le retard de 25 heures respecte cette disponibilité.

**Restitution.** Le navigateur reçoit des données vérifiables et filtre les mêmes observations. Le code ne remplace pas les chiffres par des valeurs de démonstration. Les graphiques ont des légendes, des unités et des alternatives tabulaires pour la journée.

**Limites.** L'amélioration de MAE sur le test est réelle, mais l'intervalle échoue à couvrir 90 % des observations. Expliquer cet échec est plus utile que le masquer.

## Questions à préparer

- Pourquoi agréger les demi-heures plutôt que les additionner ?
- Comment représenter les jours de 23 et 25 heures ?
- Quelle différence entre production électrique et consommation ?
- Pourquoi stocker à la fois Parquet et SQLite ?
- Pourquoi une référence hebdomadaire est-elle un minimum nécessaire ?
- Comment traiter les trous sans créer artificiellement une bonne performance ?
- Pourquoi l'intervalle est-il moins fiable en hiver ?
- Comment valider une future calibration glissante sans réutiliser le test ?
- Que faudrait-il ajouter pour exploiter ce modèle en production ?

## Appropriation personnelle

Ce projet a été construit avec assistance IA. Avant de le présenter comme compétence personnelle, exécuter le pipeline, lire les tests, modifier un indicateur et savoir expliquer une prévision depuis les données brutes. Ne pas présenter les dates des données comme les dates de réalisation ni les métriques du benchmark comme un résultat obtenu chez un employeur.
