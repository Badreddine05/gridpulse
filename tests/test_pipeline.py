import numpy as np
import pandas as pd
import pytest
from pipeline.build_dataset import FUELS, make_features, prepare_hourly, split_masks, finite_sample_quantile


def record(timestamp, consumption=100):
    return {"date_heure": timestamp, "consommation": consumption, **{f: 10 for f in FUELS}, "taux_co2": 30}


def test_hourly_energy_is_mean_power_not_sum_of_samples():
    hourly, quality = prepare_hourly([record("2024-01-01T00:00Z",100), record("2024-01-01T00:30Z",200)])
    assert hourly.consommation.iloc[0] == 150
    assert quality["incomplete_hours"] == 0


def test_duplicate_physical_instant_collapses_only_if_measurements_identical():
    a,b=record("2024-01-01T00:00Z"),record("2024-01-01T00:30Z")
    hourly,q=prepare_hourly([a,a,b])
    assert q["duplicate_timestamps"]==1 and q["unique_source_rows"]==2
    assert hourly.consommation.iloc[0]==100
    with pytest.raises(ValueError,match="Conflicting"):
        prepare_hourly([a,{**a,"consommation":200},b])


def test_missing_half_hour_is_not_imputed_or_counted_as_complete():
    hourly,q=prepare_hourly([record("2024-01-01T00:00Z")])
    assert pd.isna(hourly.consommation.iloc[0])
    assert pd.isna(hourly.nucleaire.iloc[0])
    assert q["incomplete_hours"]==1


def test_missing_one_fuel_sample_does_not_inflate_complete_production():
    first,second=record("2024-01-01T00:00Z"),record("2024-01-01T00:30Z")
    second["eolien"]=None
    hourly,q=prepare_hourly([first,second])
    assert hourly.consommation.iloc[0]==100
    assert pd.isna(hourly.eolien.iloc[0]) and q["missing_fuel_cells"]==1


def test_features_exclude_origin_hour_and_all_later_observations():
    index=pd.date_range("2024-01-01",periods=600,freq="h",tz="UTC")
    hourly=pd.DataFrame({"consommation":np.arange(600,dtype=float)},index=index)
    x=make_features(hourly)
    target=450
    assert x.iloc[target].lag_25h==target-25
    altered=hourly.copy()
    altered.iloc[target-24:]=999999
    pd.testing.assert_series_equal(x.iloc[target],make_features(altered).iloc[target])


def test_split_boundaries_are_disjoint_and_complete():
    index=pd.date_range("2024-08-31",periods=1500,freq="h",tz="UTC")
    masks=split_masks(index)
    assert np.all(sum(mask.astype(int) for mask in masks)==1)
    assert index[masks[0]].max()<index[masks[1]].min()<index[masks[2]].min()


def test_finite_sample_calibration_uses_upper_order_statistic():
    assert finite_sample_quantile(np.arange(1,10),alpha=.1)==9
    assert finite_sample_quantile([3])==3
    with pytest.raises(ValueError): finite_sample_quantile([])


def test_non_positive_consumption_fails_quality_gate():
    with pytest.raises(ValueError,match="Non-positive"):
        prepare_hourly([record("2024-01-01T00:00Z",-1)])
