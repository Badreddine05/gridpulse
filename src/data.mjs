export const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
export const FUELS = [
  { key: "nucleaire", label: "Nucléaire", color: "#bcf36a" },
  { key: "hydraulique", label: "Hydraulique", color: "#67d5e8" },
  { key: "eolien", label: "Éolien", color: "#7fa3ff" },
  { key: "solaire", label: "Solaire", color: "#efc76b" },
  { key: "gaz", label: "Gaz", color: "#b191cf" },
  { key: "bioenergies", label: "Bioénergies", color: "#73ba9a" },
  { key: "fioul", label: "Fioul", color: "#cf8e75" },
  { key: "charbon", label: "Charbon", color: "#798394" },
];
const parisDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const parisTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export const fmt = (value, decimals = 0) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      }).format(value);
export const avg = (values) => {
  const finite = values.filter(Number.isFinite);
  return finite.length
    ? finite.reduce((a, b) => a + b, 0) / finite.length
    : null;
};
export function decodeData(raw) {
  return raw.rows.map((values) => {
    const row = Object.fromEntries(
      raw.meta.columns.map((key, i) => [key, values[i]]),
    );
    const date = new Date(values[0] * 1000);
    return {
      ...row,
      date: parisDate.format(date),
      time: parisTime.format(date),
      timestamp: date.toISOString(),
    };
  });
}
export function selectRows(rows, year, month) {
  return rows.filter((r) =>
    r.date.startsWith(`${year}-${String(month).padStart(2, "0")}`),
  );
}
export function summary(rows) {
  const valid = rows.filter((r) => Number.isFinite(r.consommation));
  const complete = rows.filter((r) =>
    FUELS.every((f) => Number.isFinite(r[f.key])),
  );
  const fuels = FUELS.map((f) => ({
    ...f,
    total: complete.reduce((a, r) => a + r[f.key], 0),
  }));
  const total = fuels.reduce((a, f) => a + f.total, 0);
  const renewable = fuels
    .filter((f) =>
      ["hydraulique", "eolien", "solaire", "bioenergies"].includes(f.key),
    )
    .reduce((a, f) => a + f.total, 0);
  const carbonRows = complete.filter((r) => Number.isFinite(r.taux_co2));
  const carbonWeight = carbonRows.reduce(
    (a, r) => a + FUELS.reduce((s, f) => s + r[f.key], 0),
    0,
  );
  return {
    energy: valid.reduce((s, r) => s + r.consommation, 0) / 1e6,
    peak: valid.length
      ? Math.max(...valid.map((r) => r.consommation)) / 1000
      : null,
    renewable: total ? (renewable / total) * 100 : null,
    fuels: fuels.map((f) => ({ ...f, share: total ? f.total / total : 0 })),
    carbon: carbonWeight
      ? carbonRows.reduce(
          (s, r) => s + r.taux_co2 * FUELS.reduce((a, f) => a + r[f.key], 0),
          0,
        ) / carbonWeight
      : null,
    hours: valid.length,
    productionHours: complete.length,
  };
}
export function dailyRows(rows) {
  const groups = new Map();
  rows.forEach((r) => {
    if (!groups.has(r.date)) groups.set(r.date, []);
    groups.get(r.date).push(r);
  });
  return [...groups].map(([date, items]) => ({
    date,
    consommation: avg(items.map((r) => r.consommation)),
    prediction: avg(items.map((r) => r.prediction)),
    baseline: avg(items.map((r) => r.baseline)),
    lower: avg(items.map((r) => r.lower)),
    upper: avg(items.map((r) => r.upper)),
    peak: Math.max(...items.map((r) => r.consommation ?? -Infinity)),
    hours: items.filter((r) => Number.isFinite(r.consommation)).length,
  }));
}
export function csvForRows(rows) {
  const columns = [
    "timestamp",
    "date",
    "time",
    "consommation",
    ...FUELS.map((f) => f.key),
    "taux_co2",
    "prediction",
    "baseline",
    "lower",
    "upper",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((key) => row[key] ?? "").join(",")),
  ].join("\n");
}
