"""Rebuild GridPulse from RTE's public, definitive 2023–2024 measurements.

The published demo is a historical snapshot, never a live grid service.
Run from the repository root: python pipeline/build_dataset.py [--refresh]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import sqlite3
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT = Path(__file__).resolve().parents[1]
API = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-cons-def/exports/json"
SOURCE = "https://odre.opendatasoft.com/explore/dataset/eco2mix-national-cons-def/"
FUELS = ["nucleaire", "eolien", "solaire", "hydraulique", "gaz", "bioenergies", "fioul", "charbon"]
FIELDS = ["date_heure", "date", "heure", "consommation", *FUELS, "taux_co2"]
TRAIN_END = pd.Timestamp("2024-09-01", tz="UTC")
CAL_END = pd.Timestamp("2024-11-01", tz="UTC")


def download(refresh=False):
    raw = ROOT / "data/raw/rte-2023-2024.json"
    raw.parent.mkdir(parents=True, exist_ok=True)
    receipt = raw.with_suffix(".receipt.json")
    if not raw.exists() or refresh:
        params = {
            "select": ",".join(FIELDS),
            "where": "date_heure >= date'2022-12-31T23:00:00Z' AND date_heure < date'2024-12-31T23:00:00Z' AND consommation is not null",
            "order_by": "date_heure",
            "timezone": "Europe/Paris",
        }
        response = requests.get(API, params=params, timeout=(30, 240))
        response.raise_for_status()
        response.json()  # Do not cache an HTML error as data.
        raw.write_bytes(response.content)
        receipt.write_text(json.dumps({"url": response.url, "retrieved_at": datetime.now(timezone.utc).isoformat()}, indent=2))
    data = json.loads(raw.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise ValueError("Expected a non-empty list from the source export")
    meta = json.loads(receipt.read_text()) if receipt.exists() else {"url": API, "retrieved_at": None}
    meta["sha256"] = hashlib.sha256(raw.read_bytes()).hexdigest()
    meta["bytes"] = raw.stat().st_size
    return data, meta


def prepare_hourly(records):
    df = pd.DataFrame(records)
    source_rows = len(df)
    df["timestamp"] = pd.to_datetime(df["date_heure"], utc=True)
    duplicates = int(df.timestamp.duplicated().sum())
    if duplicates:
        # Source contains duplicated spring-DST wall-clock rows. Only identical
        # physical observations may collapse; conflicting measurements are fatal.
        numerical = ["consommation", *FUELS, "taux_co2"]
        repeated = df[df.timestamp.duplicated(keep=False)]
        if (repeated.groupby("timestamp")[numerical].nunique(dropna=False) > 1).any().any():
            raise ValueError("Conflicting values at duplicate source timestamps")
        df = df.drop_duplicates("timestamp", keep="first")
    df = df.set_index("timestamp").sort_index()
    for col in ["consommation", *FUELS, "taux_co2"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    if (df.consommation <= 0).any():
        raise ValueError("Non-positive consumption is invalid")
    numeric = df[["consommation", *FUELS, "taux_co2"]]
    hourly = numeric.resample("h").mean()
    hourly = hourly.where(numeric.resample("h").count() == 2)
    counts = df.consommation.resample("h").count()
    # A complete hour needs two half-hourly observations; no target imputation.
    hourly.loc[counts != 2, "consommation"] = np.nan
    hourly["observations"] = counts
    hourly["date"] = hourly.index.tz_convert("Europe/Paris").strftime("%Y-%m-%d")
    quality = {
        "source_rows": source_rows, "duplicate_timestamps": duplicates,
        "unique_source_rows": len(df), "duplicate_policy": "collapse only numerically identical physical timestamps; reject conflicts",
        "hourly_rows": len(hourly), "incomplete_hours": int((counts != 2).sum()),
        "missing_consumption_hours": int(hourly.consommation.isna().sum()),
        "missing_fuel_cells": int(hourly[FUELS].isna().sum().sum()),
        "missing_carbon_hours": int(hourly.taux_co2.isna().sum()),
        "first_utc": hourly.index.min().isoformat(), "last_utc": hourly.index.max().isoformat(),
        "target_imputation": "none", "timestamp_zone": "UTC; display Europe/Paris",
    }
    return hourly, quality


def make_features(hourly):
    """Every observed value is available at or before t−24h (24h-ahead task)."""
    y = hourly.consommation
    local = hourly.index.tz_convert("Europe/Paris")
    f = pd.DataFrame(index=hourly.index)
    # Timestamps label the START of the measured hour. The t−24h mean would
    # include a future half-hour at the forecast origin; t−25h is completed.
    for lag in [25, 48, 72, 168, 336]:
        f[f"lag_{lag}h"] = y.shift(lag)
    f["mean_24h_at_origin"] = y.shift(25).rolling(24, min_periods=24).mean()
    f["mean_168h_at_origin"] = y.shift(25).rolling(168, min_periods=168).mean()
    f["hour"] = local.hour
    f["weekday"] = local.dayofweek
    f["month"] = local.month
    f["day_sin"] = np.sin(2 * np.pi * local.dayofyear / 365.25)
    f["day_cos"] = np.cos(2 * np.pi * local.dayofyear / 365.25)
    return f


def split_masks(index):
    return index < TRAIN_END, (index >= TRAIN_END) & (index < CAL_END), index >= CAL_END


def finite_sample_quantile(residuals, alpha=0.1):
    values = np.sort(np.asarray(residuals))
    if not len(values):
        raise ValueError("Calibration must not be empty")
    rank = min(len(values), math.ceil((len(values) + 1) * (1 - alpha)))
    return float(values[rank - 1])


def forecast(hourly):
    features = make_features(hourly)
    valid = features.notna().all(axis=1) & hourly.consommation.notna()
    x, y = features.loc[valid], hourly.loc[valid, "consommation"]
    train, cal, test = split_masks(x.index)
    # Fixed hyperparameters; no tuning or fitting on calibration/test data.
    model = HistGradientBoostingRegressor(max_iter=180, max_leaf_nodes=15, learning_rate=0.06,
                                         l2_regularization=10, random_state=42, early_stopping=False)
    model.fit(x.loc[train], y.loc[train])
    q = finite_sample_quantile(np.abs(y.loc[cal] - model.predict(x.loc[cal])))
    prediction = model.predict(x.loc[test])
    baseline = x.loc[test, "lag_168h"].to_numpy()
    truth = y.loc[test].to_numpy()
    hourly["prediction"] = np.nan
    hourly["baseline"] = np.nan
    hourly["lower"] = np.nan
    hourly["upper"] = np.nan
    hourly.loc[x.index[test], "prediction"] = prediction
    hourly.loc[x.index[test], "baseline"] = baseline
    hourly.loc[x.index[test], "lower"] = np.maximum(0, prediction - q)
    hourly.loc[x.index[test], "upper"] = prediction + q
    metrics = {
        "model": "HistGradientBoostingRegressor", "horizon_hours": 24,
        "train_rows": int(train.sum()), "calibration_rows": int(cal.sum()), "test_rows": int(test.sum()),
        "train_end_exclusive_utc": TRAIN_END.isoformat(), "calibration_end_exclusive_utc": CAL_END.isoformat(),
        "train_first_utc": x.index[train].min().isoformat(),
        "test_first_utc": x.index[test].min().isoformat(), "test_last_utc": x.index[test].max().isoformat(),
        "mae_mw": round(float(mean_absolute_error(truth, prediction)), 2),
        "rmse_mw": round(float(np.sqrt(mean_squared_error(truth, prediction))), 2),
        "baseline_mae_mw": round(float(mean_absolute_error(truth, baseline)), 2),
        "baseline_rmse_mw": round(float(np.sqrt(mean_squared_error(truth, baseline))), 2),
        "interval_nominal_coverage": 0.9,
        "interval_empirical_coverage": round(float(np.mean(np.abs(truth - prediction) <= q)), 4),
        "interval_half_width_mw": round(q, 2),
        "feature_names": list(x.columns),
        "caution": "Intervalle calibré sur septembre–octobre 2024. La couverture future n'est pas garantie : les résidus temporels ne sont pas échangeables.",
    }
    return hourly, metrics


def compact(v):
    return None if pd.isna(v) else round(float(v), 2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="Re-download the official source snapshot")
    args = parser.parse_args()
    records, source = download(args.refresh)
    hourly, quality = prepare_hourly(records)
    hourly, metrics = forecast(hourly)
    processed = ROOT / "data/processed"
    processed.mkdir(parents=True, exist_ok=True)
    hourly.to_parquet(processed / "electricity_hourly.parquet")
    with sqlite3.connect(processed / "gridpulse.sqlite") as conn:
        hourly.reset_index().to_sql("electricity_hourly", conn, if_exists="replace", index=False)
        conn.executescript((ROOT / "sql/analytics.sql").read_text(encoding="utf-8"))
    columns = ["consommation", *FUELS, "taux_co2", "prediction", "baseline", "lower", "upper"]
    rows = [[int(t.timestamp()), *[compact(row[c]) for c in columns]] for t, row in hourly.iterrows()]
    manifest = {
        "title": "RTE éCO2mix · France · 2023–2024", "source_url": SOURCE,
        "source": source, "license": "Licence Ouverte / Open Licence Etalab 2.0",
        "license_url": "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
        "snapshot_type": "historical", "period": "2023-01-01 / 2024-12-31",
        "quality": quality, "model": metrics,
        "columns": ["unix_seconds_utc", *columns], "power_unit": "MW", "carbon_unit": "gCO2/kWh",
    }
    public = ROOT / "public/data"
    public.mkdir(parents=True, exist_ok=True)
    (public / "gridpulse.json").write_text(json.dumps({"meta": manifest, "rows": rows}, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    (ROOT / "data/manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    hourly.reset_index().to_csv(processed / "electricity_hourly.csv", index=False)
    print(json.dumps({"quality": quality, "metrics": metrics, "source_sha256": source["sha256"]}, indent=2))


if __name__ == "__main__":
    main()
