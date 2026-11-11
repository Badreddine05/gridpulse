import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FUELS,
  summary,
  dailyRows,
  csvForRows,
  decodeData,
  selectRows,
} from "../src/data.mjs";

const row = (extra = {}) => ({
  consommation: 1000,
  taux_co2: 20,
  ...Object.fromEntries(FUELS.map((f) => [f.key, 100])),
  date: "2024-01-01",
  time: "00:00",
  timestamp: "2023-12-31T23:00:00Z",
  ...extra,
});

test("energy integrates hourly means, renewable excludes nuclear", () => {
  const s = summary([row(), row()]);
  assert.equal(s.energy, 0.002);
  assert.equal(s.renewable, 50);
  assert.equal(s.peak, 1);
  assert.equal(s.carbon, 20);
});
test("missing consumption and incomplete mix are excluded, never replaced by zero", () => {
  const s = summary([row(), row({ consommation: null, eolien: null })]);
  assert.equal(s.energy, 0.001);
  assert.equal(s.hours, 1);
  assert.equal(s.productionHours, 1);
});
test("carbon intensity is production-weighted", () => {
  const a = row(),
    b = row({ taux_co2: 40, nucleaire: 900 });
  assert.equal(summary([a, b]).carbon, 100 / 3);
});
test("CSV has expected values and missing values stay blank", () => {
  const csv = csvForRows([row()]);
  assert.ok(csv.startsWith("timestamp,date,time,consommation,"));
  assert.ok(csv.includes(",1000,"));
  assert.ok(csv.endsWith(",,,,"));
  assert.ok(!csv.includes("undefined"));
});
test("empty selection is explicitly undefined rather than a misleading KPI", () => {
  const s = summary([]);
  assert.equal(s.renewable, null);
  assert.equal(s.peak, null);
  assert.equal(s.carbon, null);
});
test("published snapshot has provenance, monotonic timestamps and calibration/test separation", () => {
  const raw = JSON.parse(
    readFileSync(new URL("../public/data/gridpulse.json", import.meta.url)),
  );
  assert.match(raw.meta.source.sha256, /^[0-9a-f]{64}$/);
  const rows = decodeData(raw);
  assert.ok(rows.length > 17000);
  assert.ok(
    rows.every(
      (r, i) => !i || r.unix_seconds_utc > rows[i - 1].unix_seconds_utc,
    ),
  );
  assert.equal(rows[0].date, "2023-01-01");
  assert.equal(rows.at(-1).date, "2024-12-31");
  const forecasts = rows.filter((r) => r.prediction != null);
  assert.equal(forecasts.length, raw.meta.model.test_rows);
  assert.ok(
    forecasts.every(
      (r) =>
        r.timestamp >=
        raw.meta.model.calibration_end_exclusive_utc.replace("+00:00", "Z"),
    ),
  );
  assert.equal(selectRows(rows, 2023, 12).length, 744);
  assert.ok(dailyRows(selectRows(rows, 2024, 3)).some((r) => r.hours === 23));
});
