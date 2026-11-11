# Fiche du modèle

## Question

Prédire la puissance moyenne consommée pendant l'heure cible `t`, avec une origine de prévision fixée à `t − 24 h`.

Les moyennes horaires sont étiquetées par leur **début**. La moyenne de l'heure `t − 24 h` contient une mesure postérieure à l'origine et serait une fuite. Le retard le plus récent est donc **25 heures** : sa fenêtre est terminée à l'origine. Les autres retards valent 48, 72, 168 et 336 heures. Les moyennes glissantes de 24 et 168 heures se terminent également sur le retard de 25 heures.

Les variables calendaires sont l'heure et le jour de semaine en Europe/Paris, le mois et un encodage sin/cos du jour dans l'année. Elles sont connues à l'origine. Aucune température future ni prévision de RTE n'entre dans le modèle.

## Découpage

| Ensemble | Bornes UTC | Rôle |
|---|---|---|
| Entraînement | avant le 1er septembre 2024 | Ajuster les arbres |
| Calibration | du 1er septembre au 1er novembre 2024 exclu | Choisir la largeur de l'intervalle |
| Test | à partir du 1er novembre 2024 | Mesurer les performances finales |

Les premières 336 heures et toutes les lignes dont la cible ou une variable est absente sont exclues. Les trous de données de fin octobre affectent ainsi les premiers jours et certaines heures de novembre. Le test réellement exploitable commence le **4 novembre 2024 à 01:00 UTC**, avec 1 389 heures au total ; le manifeste donne tous les comptes.

L'évaluation utilise des origines glissantes : les observations du test peuvent devenir des retards **une fois disponibles** à l'origine d'une prévision ultérieure. Le modèle reste figé ; aucun ajustement n'utilise les cibles de test.

## Modèle et référence

`HistGradientBoostingRegressor`, scikit-learn, paramètres fixes : 180 itérations, 15 feuilles, taux d'apprentissage 0,06, pénalisation L2 de 10, seed 42, arrêt anticipé désactivé. Aucun choix d'hyperparamètre n'est fait en fonction du test.

Référence : consommation à la même position horaire UTC sept jours auparavant. Lors du passage à l'heure d'hiver, cela ne correspond pas toujours à la même heure locale ; il s'agit d'une référence simple de décalage temporel, explicitement conservée.

## Mesures

Sur le test : MAE modèle **2 709,55 MW**, RMSE **3 539,45 MW**. La référence atteint MAE **4 960,96 MW**, RMSE **5 742,04 MW**. Les métriques sont calculées sur les mêmes heures admissibles.

La MAE mesure une erreur absolue moyenne en unités métier. La RMSE donne plus de poids aux fortes erreurs. Aucune métrique ne mesure ici un impact économique ou un gain opérationnel réel.

## Intervalle : un échec de couverture à conserver

On calcule les résidus absolus sur la calibration et le quantile d'ordre `ceil((n+1) × 0,9)`, borné à la taille de l'échantillon. La demi-largeur retenue est **1 922,16 MW**. Les bornes du test sont prévision ± cette valeur, avec borne basse ramenée à zéro.

La couverture réelle est **47,37 %**, bien sous le niveau nominal de 90 %. Les erreurs hivernales sont plus grandes que celles observées pendant la calibration. Les données sont temporellement dépendantes et non échangeables ; une garantie de type conformal i.i.d. ne s'applique pas automatiquement.

Le site montre cette différence et ne présente pas l'intervalle comme une confiance de 90 % validée. Un prochain travail pourrait définir une calibration glissante ou normalisée sur une période de développement, puis la tester sur **une nouvelle période jamais consultée**. Il ne faudrait pas réutiliser ce même test pour annoncer une amélioration non biaisée.

## Limites opérationnelles

- Un seul pays et deux années ; pas d'estimation de généralisation pluriannuelle.
- Les jours fériés ne sont pas modélisés explicitement.
- Les délais réels de publication et les révisions de données ne sont pas simulés : les mesures sont supposées disponibles à la fin de l'heure.
- Les données sont consolidées/définitives, sans reconstruction des versions qui auraient été accessibles en temps réel.
- Le modèle ne pilote aucune infrastructure et ne constitue pas un service de prévision exploitable en production.

Les tests anti-fuite modifient toutes les observations à partir de l'origine et vérifient que les variables de la cible restent identiques. Un changement des sources ou des paramètres exige une nouvelle exécution du pipeline et une mise à jour du manifeste.
