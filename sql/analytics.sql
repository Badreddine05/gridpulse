-- Electricity is measured as hourly mean power (MW).
-- Multiplying by one hour gives MWh; /1000 gives GWh.
-- The date column is the Europe/Paris date, including DST days.
CREATE VIEW IF NOT EXISTS daily_kpis AS
SELECT date, COUNT(consommation) AS valid_hours,
       SUM(consommation)/1000.0 AS consumption_gwh,
       MAX(consommation) AS peak_mw,
       AVG(consommation) AS average_mw,
       SUM(nucleaire+eolien+solaire+hydraulique+gaz+bioenergies+fioul+charbon)/1000.0 AS production_gwh,
       SUM(eolien+solaire+hydraulique+bioenergies)/1000.0 AS renewable_gwh
FROM electricity_hourly GROUP BY date;

CREATE VIEW IF NOT EXISTS monthly_kpis AS
SELECT substr(date,1,7) AS month,
       SUM(consumption_gwh) AS consumption_gwh,
       MAX(peak_mw) AS peak_mw,
       SUM(renewable_gwh)/NULLIF(SUM(production_gwh),0) AS renewable_share
FROM daily_kpis GROUP BY substr(date,1,7);

CREATE VIEW IF NOT EXISTS forecast_errors AS
SELECT timestamp, consommation, prediction, baseline,
       ABS(consommation-prediction) AS model_absolute_error_mw,
       ABS(consommation-baseline) AS baseline_absolute_error_mw,
       CASE WHEN consommation BETWEEN lower AND upper THEN 1 ELSE 0 END AS interval_contains_actual
FROM electricity_hourly WHERE prediction IS NOT NULL;
