import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Zap,
  Activity,
  ChartNoAxesCombined,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Download,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  CalendarDays,
  Wind,
  Leaf,
  FlaskConical,
  Check,
  ExternalLink,
  Info,
  Menu,
  X,
  Github,
  Sun,
  Moon,
  Radio,
  Layers,
  ShieldCheck,
  Clock,
  Target,
} from "lucide-react";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import {
  MONTHS,
  FUELS,
  fmt,
  powerToGw as gw,
  avg,
  decodeData,
  selectRows,
  summary,
  dailyRows,
  csvForRows,
} from "./data.mjs";
import "./style.css";

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dateLabel = (date) => DATE_FMT.format(new Date(date + "T12:00:00Z"));
const shortDate = (date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
const sourceLink =
  "https://odre.opendatasoft.com/explore/dataset/eco2mix-national-cons-def/";

function Spark({ values, color = "#bcf36a" }) {
  if (!values.length) return null;
  const lo = Math.min(...values),
    hi = Math.max(...values),
    y = (v) => 40 - ((v - lo) / (hi - lo || 1)) * 32;
  const d = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${(i / (values.length - 1 || 1)) * 100},${y(v)}`,
    )
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 44" aria-hidden="true">
      <path
        d={d}
        stroke={color}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Kpi({ label, value, unit, foot, icon: Icon, accent, values, delta }) {
  return (
    <article className={"kpi " + (accent ? "accent" : "")}>
      <div className="kpi-label">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <div className="kpi-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="kpi-bottom">
        <span>
          {delta != null ? (
            <b className={delta < 0 ? "positive" : "neutral"}>
              {delta < 0 ? (
                <ArrowDownRight size={13} />
              ) : (
                <ArrowUpRight size={13} />
              )}{" "}
              {fmt(Math.abs(delta), 1)} %
            </b>
          ) : null}
          {foot}
        </span>
        <Spark values={values || []} color={accent ? "#bcf36a" : "#69828c"} />
      </div>
    </article>
  );
}

function Chart({
  data,
  cursor,
  onCursor,
  forecast = false,
  daily = false,
  baseline = true,
}) {
  const [hover, setHover] = useState(null);
  const w = 900,
    h = 280,
    pad = { l: 49, r: 18, t: 21, b: 32 };
  const all = data
    .flatMap((r) => [
      r.consommation,
      forecast ? r.upper : null,
      forecast ? r.lower : null,
      forecast && baseline ? r.baseline : null,
    ])
    .filter(Number.isFinite);
  if (!all.length)
    return <div className="empty">Aucune mesure pour cette sélection.</div>;
  const lo = Math.floor((Math.min(...all) - 3000) / 10000) * 10000,
    hi = Math.ceil((Math.max(...all) + 3000) / 10000) * 10000;
  const x = (i) => pad.l + (i / (data.length - 1 || 1)) * (w - pad.l - pad.r),
    y = (v) => h - pad.b - ((v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
  const line = (key) =>
    data
      .map((r, i) =>
        Number.isFinite(r[key])
          ? `${i === 0 || !Number.isFinite(data[i - 1]?.[key]) ? "M" : "L"}${x(i)},${y(r[key])}`
          : "",
      )
      .join(" ");
  const active = hover ?? Math.min(cursor ?? data.length - 1, data.length - 1),
    point = data[active];
  const ticks = Array.from({ length: 5 }, (_, i) => lo + (i * (hi - lo)) / 4);
  const xs = [
    0,
    Math.round((data.length - 1) / 4),
    Math.round((data.length - 1) / 2),
    Math.round((data.length - 1) * 0.75),
    data.length - 1,
  ];
  const validBand = data.every(
    (r) => Number.isFinite(r.lower) && Number.isFinite(r.upper),
  );
  const band = validBand
    ? data.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.upper)}`).join(" ") +
      [...data]
        .reverse()
        .map((r, j) => `L${x(data.length - 1 - j)},${y(r.lower)}`)
        .join(" ") +
      "Z"
    : "";
  const observedArea = data.every((r) => Number.isFinite(r.consommation))
    ? line("consommation") +
      ` L${x(data.length - 1)},${h - pad.b} L${x(0)},${h - pad.b}Z`
    : "";
  return (
    <div className="chart-container">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={
          forecast
            ? "Consommation observée, prévision et intervalle calibré en gigawatts"
            : "Consommation horaire observée en gigawatts"
        }
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaDemand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b7ef67" stopOpacity=".16" />
            <stop offset="100%" stopColor="#b7ef67" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={y(t)}
              y2={y(t)}
              className="grid-line"
            />
            <text
              x={pad.l - 12}
              y={y(t) + 4}
              textAnchor="end"
              className="axis-label"
            >
              {fmt(t / 1000, Number.isInteger(t / 1000) ? 0 : 1)}
            </text>
          </g>
        ))}
        <text x="8" y="12" className="axis-label axis-unit">
          GW
        </text>
        {xs.map((i, j) => (
          <text
            key={j}
            x={x(i)}
            y={h - 6}
            textAnchor={j === 0 ? "start" : j === 4 ? "end" : "middle"}
            className="axis-label"
          >
            {daily ? shortDate(data[i].date) : data[i].time}
          </text>
        ))}
        {forecast && band ? (
          <path d={band} fill="#67d5e8" fillOpacity=".12" />
        ) : null}
        {!forecast && observedArea ? (
          <path d={observedArea} fill="url(#areaDemand)" />
        ) : null}
        {forecast && baseline ? (
          <path d={line("baseline")} className="baseline-line" />
        ) : null}
        {forecast ? (
          <path d={line("prediction")} className="forecast-line" />
        ) : null}
        <path d={line("consommation")} className="demand-line" />
        {point && Number.isFinite(point.consommation) ? (
          <g className="chart-cursor">
            <line
              x1={x(active)}
              x2={x(active)}
              y1={pad.t}
              y2={h - pad.b}
              stroke="#c6dcce"
              strokeDasharray="3 6"
              opacity=".32"
            />
            <circle
              cx={x(active)}
              cy={y(point.consommation)}
              r="8"
              fill="#bcf36a"
              opacity=".14"
            />
            <circle
              cx={x(active)}
              cy={y(point.consommation)}
              r="4"
              fill="#bcf36a"
              stroke="#0e1820"
              strokeWidth="2"
            />
          </g>
        ) : null}
        {data.map((r, i) => (
          <rect
            key={i}
            x={x(i) - (w - pad.l - pad.r) / (data.length - 1 || 1) / 2}
            y={pad.t}
            width={(w - pad.l - pad.r) / (data.length - 1 || 1)}
            height={h - pad.t - pad.b}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onClick={() => onCursor?.(i)}
          >
            <title>
              {daily ? r.date : r.time} · {fmt(gw(r.consommation), 2)} GW
              {r.prediction != null
                ? ` · Prévision ${fmt(r.prediction / 1000, 2)} GW`
                : ""}
            </title>
          </rect>
        ))}
      </svg>
      <div className="chart-readout">
        <span>{daily ? shortDate(point.date) : point.time}</span>
        <b>
          {fmt(gw(point.consommation), 2)} <small>GW observés</small>
        </b>
        {forecast && point.prediction != null ? (
          <b className="cyan">
            {fmt(point.prediction / 1000, 2)} <small>GW prévus</small>
          </b>
        ) : null}
      </div>
    </div>
  );
}

function Mix({ rows, caption }) {
  const sum = summary(rows),
    fuels = sum.fuels;
  if (!sum.productionHours) {
    return (
      <section className="panel mix-missing">
        <p className="eyebrow">PRODUCTION</p>
        <h2>Le mix électrique</h2>
        <div className="empty">
          <div>
            <Info size={24} />
            <p>Mesures absentes pour cette heure.</p>
            <small>Le mix n'est pas calculé sans données complètes.</small>
          </div>
        </div>
        <p className="panel-note">{caption}</p>
      </section>
    );
  }
  let accumulated = 0;
  return (
    <section className="panel mix-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PRODUCTION</p>
          <h2>Le mix électrique</h2>
        </div>
        <Layers size={18} />
      </div>
      <div className="donut-wrap">
        <svg
          viewBox="0 0 200 200"
          aria-label="Répartition de la production électrique par filière"
          role="img"
        >
          <circle
            cx="100"
            cy="100"
            r="77"
            stroke="#1d2932"
            strokeWidth="18"
            fill="none"
          />
          {fuels.map((f) => {
            const start = accumulated;
            accumulated += f.share;
            return (
              <circle
                key={f.key}
                cx="100"
                cy="100"
                r="77"
                fill="none"
                stroke={f.color}
                strokeWidth="18"
                strokeDasharray={`${Math.max(0, f.share * 483.8 - 2)} ${483.8}`}
                strokeDashoffset={-start * 483.8}
                transform="rotate(-90 100 100)"
                className="mix-arc"
              >
                <title>
                  {f.label} : {fmt(f.share * 100, 1)} %
                </title>
              </circle>
            );
          })}
        </svg>
        <div className="donut-center">
          <Leaf size={19} />
          <strong>
            {fmt(sum.renewable, 1)}
            <small>%</small>
          </strong>
          <span>renouvelable</span>
        </div>
      </div>
      <p className="mix-caption">{caption}</p>
      <div className="mix-list">
        {fuels.map((f) => (
          <div key={f.key}>
            <span>
              <i style={{ background: f.color }} />
              {f.label}
            </span>
            <b>
              {fmt(f.share * 100, 1)} <small>%</small>
            </b>
          </div>
        ))}
      </div>
      <p className="panel-note">
        Part de production · nucléaire inclus dans le total, hors renouvelables.
      </p>
    </section>
  );
}

function Calendar({ rows, year, onSelect, selected }) {
  const data = dailyRows(rows.filter((r) => r.date.startsWith(String(year))));
  const peaks = data.map((d) => d.peak),
    min = Math.min(...peaks),
    max = Math.max(...peaks);
  const firstDay = new Date(`${year}-01-01T12:00:00Z`).getUTCDay();
  const offset = (firstDay + 6) % 7;
  return (
    <section className="panel calendar-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">UNE ANNÉE EN UN REGARD</p>
          <h2>Le calendrier des pointes</h2>
        </div>
        <span className="subtle-tag">{year}</span>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-months">
          {MONTHS.map((m) => (
            <span key={m}>{m.slice(0, 3)}.</span>
          ))}
        </div>
        <div className="heatmap-grid">
          {Array.from({ length: offset }, (_, i) => (
            <span key={"pad" + i} />
          ))}
          {data.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelect(d.date)}
              className={selected === d.date ? "selected" : ""}
              style={{
                background: `color-mix(in srgb, #bcf36a ${18 + ((d.peak - min) / (max - min || 1)) * 82}%, #152229)`,
              }}
              aria-label={`${dateLabel(d.date)}, pointe ${fmt(d.peak / 1000, 1)} GW`}
              title={`${dateLabel(d.date)} · ${fmt(d.peak / 1000, 1)} GW`}
            />
          ))}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>Cliquer sur un jour pour explorer sa courbe.</span>
        <div>
          <span>{fmt(min / 1000)} GW</span>
          {[20, 40, 60, 80, 100].map((a) => (
            <i
              key={a}
              style={{
                background: `color-mix(in srgb, #bcf36a ${a}%, #152229)`,
              }}
            />
          ))}
          <span>{fmt(max / 1000)} GW</span>
        </div>
      </div>
    </section>
  );
}

function Overview({
  rows,
  year,
  month,
  day,
  setDay,
  setMonth,
  setYear,
  selection,
}) {
  const [cursor, setCursor] = useState(12),
    [playing, setPlaying] = useState(false),
    [showForecast, setShowForecast] = useState(true);
  const days = useMemo(() => dailyRows(selection), [selection]);
  const dayRows = useMemo(
    () => selection.filter((r) => r.date === day),
    [selection, day],
  );
  const actualDay = dayRows.length ? dayRows : selection.slice(0, 24);
  useEffect(() => {
    setPlaying(false);
    setCursor(12);
  }, [day, month, year]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setCursor((i) => (i + 1) % actualDay.length),
      750,
    );
    return () => clearInterval(id);
  }, [playing, actualDay.length]);
  const selected = actualDay[Math.min(cursor, actualDay.length - 1)];
  const sum = summary(selection),
    prev = summary(
      selectRows(
        rows,
        month === 1 ? year - 1 : year,
        month === 1 ? 12 : month - 1,
      ),
    );
  const delta = prev.energy ? (sum.energy / prev.energy - 1) * 100 : null;
  const hasForecast = actualDay.some((r) => r.prediction != null);
  function chooseDate(d) {
    setYear(Number(d.slice(0, 4)));
    setMonth(Number(d.slice(5, 7)));
    setDay(d);
  }
  return (
    <>
      <div className="kpis">
        <Kpi
          label="Consommation du mois"
          value={fmt(sum.energy, 2)}
          unit="TWh"
          icon={Zap}
          accent
          values={days.map((d) => d.consommation)}
          delta={delta}
          foot={delta == null ? "Énergie consommée" : "vs mois précédent"}
        />
        <Kpi
          label="Pointe de consommation"
          value={fmt(sum.peak, 1)}
          unit="GW"
          icon={Activity}
          values={days.map((d) => d.peak)}
          foot="Maximum horaire du mois"
        />
        <Kpi
          label="Production renouvelable"
          value={fmt(sum.renewable, 1)}
          unit="%"
          icon={Wind}
          values={[]}
          foot="Éolien, solaire, hydraulique, bio"
        />
        <Kpi
          label="Intensité carbone"
          value={fmt(sum.carbon, 1)}
          unit="gCO₂/kWh"
          icon={Leaf}
          values={[]}
          foot="Moyenne pondérée par production"
        />
      </div>
      <div className="chart-layout">
        <section className="panel demand-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">EXPLORER UNE JOURNÉE</p>
              <h2>Le pouls du réseau</h2>
            </div>
            <label className="date-control">
              <CalendarDays size={14} />
              <select
                aria-label="Jour à explorer"
                value={actualDay[0]?.date || ""}
                onChange={(e) => setDay(e.target.value)}
              >
                {days.map((d) => (
                  <option value={d.date} key={d.date}>
                    {dateLabel(d.date)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <div className="chart-meta">
            <div className="chart-main-number">
              {fmt(gw(selected?.consommation), 1)}
              <span>GW</span>
              <small>à {selected?.time}</small>
            </div>
            <div className="chart-legends">
              <span>
                <i className="mint-dot" />
                Observé
              </span>
              {hasForecast ? (
                <button
                  className={"legend-toggle " + (showForecast ? "on" : "")}
                  aria-pressed={showForecast}
                  onClick={() => setShowForecast(!showForecast)}
                >
                  <i className="cyan-dot" />
                  Prévision J+24 h
                </button>
              ) : (
                <span className="muted">Historique RTE</span>
              )}
            </div>
          </div>
          <Chart
            data={actualDay}
            cursor={cursor}
            onCursor={setCursor}
            forecast={hasForecast && showForecast}
            baseline={false}
          />
          <div className="playback">
            <button
              className={"play-button " + (playing ? "playing" : "")}
              aria-label={playing ? "Mettre en pause" : "Lire la journée"}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <input
              aria-label="Heure explorée"
              type="range"
              min="0"
              max={Math.max(0, actualDay.length - 1)}
              value={Math.min(cursor, actualDay.length - 1)}
              onChange={(e) => {
                setPlaying(false);
                setCursor(Number(e.target.value));
              }}
            />
            <span className="time-stamp">{selected?.time}</span>
            <button
              className="icon-button"
              aria-label="Revenir à minuit"
              onClick={() => {
                setPlaying(false);
                setCursor(0);
              }}
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <div className="chart-footer">
            <span>
              <Clock size={13} />
              Moyennes horaires · heure de Paris
            </span>
            <span>
              {actualDay.length} observations{" "}
              {hasForecast && showForecast
                ? "· intervalle calibré · nominal 90 %"
                : ""}
            </span>
          </div>
        </section>
        <Mix
          rows={selected ? [selected] : []}
          caption={
            selected
              ? `${dateLabel(selected.date)} · ${selected.time}`
              : "Aucune observation"
          }
        />
      </div>
      <Calendar rows={rows} year={year} onSelect={chooseDate} selected={day} />
      <div className="bottom-grid">
        <section className="panel monthly-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SAISONNALITÉ</p>
              <h2>La consommation au fil des mois</h2>
            </div>
            <span className="subtle-tag">TWh</span>
          </div>
          <div className="monthly-bars">
            {MONTHS.map((m, i) => {
              const value = summary(selectRows(rows, year, i + 1)).energy;
              return (
                <button
                  className={month === i + 1 ? "active" : ""}
                  onClick={() => {
                    setMonth(i + 1);
                    setDay(`${year}-${String(i + 1).padStart(2, "0")}-11`);
                  }}
                  key={m}
                  title={`${m} ${year} : ${fmt(value, 2)} TWh`}
                >
                  <span>{fmt(value, 1)}</span>
                  <i style={{ height: `${(value / 55) * 125}px` }} />
                  <small>{m.slice(0, 3)}</small>
                </button>
              );
            })}
          </div>
        </section>
        <section className="insight-card">
          <div className="insight-icon">
            <FlaskConical size={20} />
          </div>
          <p className="eyebrow">LIRE LES CHIFFRES</p>
          <h2>
            Une photographie du réseau,
            <br />
            pas une mesure en direct.
          </h2>
          <p>
            Explorez les données historiques 2023–2024. Les prévisions de
            novembre et décembre 2024 sont évaluées sur des observations exclues
            de l'entraînement.
          </p>
          <div className="insight-foot">
            <span className="status-dot" />
            Source publique RTE · éCO2mix
          </div>
        </section>
      </div>
      <details className="data-table">
        <summary>
          Consulter les valeurs de la journée <ChevronDown size={15} />
        </summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Heure (Paris)</th>
                <th>Consommation (MW)</th>
                <th>Prévision (MW)</th>
                <th>CO₂ (g/kWh)</th>
              </tr>
            </thead>
            <tbody>
              {actualDay.map((r) => (
                <tr key={r.timestamp}>
                  <td>{r.time}</td>
                  <td>{fmt(r.consommation, 1)}</td>
                  <td>{fmt(r.prediction, 1)}</td>
                  <td>{fmt(r.taux_co2, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function Forecast({ rows, meta }) {
  const [period, setPeriod] = useState("all"),
    [baseline, setBaseline] = useState(true);
  const metrics = meta.model;
  const test = rows.filter(
    (r) =>
      r.prediction != null && (period === "all" || r.date.startsWith(period)),
  );
  const days = dailyRows(test),
    mae = avg(test.map((r) => Math.abs(r.consommation - r.prediction))),
    baseMae = avg(test.map((r) => Math.abs(r.consommation - r.baseline)));
  const gain = (1 - mae / baseMae) * 100;
  const coverage =
    (test.filter((r) => r.consommation >= r.lower && r.consommation <= r.upper)
      .length /
      test.length) *
    100;
  return (
    <>
      <div className="forecast-intro">
        <div>
          <span className="section-label">
            <FlaskConical size={15} /> LABORATOIRE DE PRÉVISION
          </span>
          <h2>Prévoir. Comparer. Mesurer.</h2>
          <p>
            Une vraie évaluation à 24 heures, sur un futur tenu à l'écart du
            modèle.
          </p>
        </div>
        <label className="select-label">
          Période évaluée
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">Novembre + décembre 2024</option>
            <option value="2024-11">Novembre 2024</option>
            <option value="2024-12">Décembre 2024</option>
          </select>
        </label>
      </div>
      <div className="kpis">
        <Kpi
          label="Erreur absolue moyenne"
          value={fmt(mae / 1000, 2)}
          unit="GW"
          icon={Target}
          accent
          foot={`${fmt(test.length)} heures évaluées`}
        />
        <Kpi
          label="Erreur du modèle de référence"
          value={fmt(baseMae / 1000, 2)}
          unit="GW"
          icon={Activity}
          foot="Même heure, une semaine avant"
        />
        <Kpi
          label="Écart d'erreur vs référence"
          value={(gain >= 0 ? "−" : "+") + fmt(Math.abs(gain), 1)}
          unit="%"
          icon={ChartNoAxesCombined}
          foot={
            gain >= 0 ? "Erreur moyenne réduite" : "Erreur moyenne supérieure"
          }
        />
        <Kpi
          label="Couverture de l'intervalle"
          value={fmt(coverage, 1)}
          unit="%"
          icon={ShieldCheck}
          foot="Niveau nominal : 90 %"
        />
      </div>
      <section className="panel forecast-chart">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">TEST HORS ENTRAÎNEMENT</p>
            <h2>Prévision et réalité, côte à côte</h2>
          </div>
          <button
            className="small-button"
            aria-pressed={baseline}
            onClick={() => setBaseline(!baseline)}
          >
            {baseline ? <Check size={14} /> : <span className="check-box" />}
            Afficher la référence
          </button>
        </div>
        <div className="forecast-legend">
          <span>
            <i className="mint-dot" />
            Consommation réelle
          </span>
          <span>
            <i className="cyan-dot" />
            Modèle à 24 h
          </span>
          {baseline ? (
            <span>
              <i className="gray-dot" />
              Référence hebdomadaire
            </span>
          ) : null}
          <span>
            <i className="band-dot" />
            Intervalle calibré
          </span>
        </div>
        <Chart data={days} forecast daily baseline={baseline} />
        <p className="panel-note">
          Courbes : moyennes journalières des valeurs horaires. Les erreurs et
          la couverture ci-dessus sont calculées heure par heure. L'intervalle
          affiché est la moyenne des bornes horaires, sans garantie de
          couverture journalière.
        </p>
      </section>
      <div className="model-grid">
        <section className="panel">
          <p className="eyebrow">UN DÉCOUPAGE CHRONOLOGIQUE</p>
          <h2>Le futur reste dans le futur.</h2>
          <div className="split-track">
            <span className="split-train" />
            <span className="split-cal" />
            <span className="split-test" />
          </div>
          <div className="split-labels">
            <div>
              <i className="mint-dot" />
              <b>Entraînement</b>
              <span>Jan. 2023 → août 2024</span>
              <small>{fmt(metrics.train_rows)} heures valides</small>
            </div>
            <div>
              <i className="cyan-dot" />
              <b>Calibration</b>
              <span>Sept. → oct. 2024</span>
              <small>{fmt(metrics.calibration_rows)} heures</small>
            </div>
            <div>
              <i className="violet-dot" />
              <b>Test final</b>
              <span>Nov. → déc. 2024</span>
              <small>{fmt(metrics.test_rows)} heures</small>
            </div>
          </div>
        </section>
        <section className="panel model-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">LE MODÈLE</p>
              <h2>Gradient boosting</h2>
            </div>
            <Layers size={20} />
          </div>
          <ul>
            <li>
              <Check size={15} />
              Consommation passée : 25 h à 14 jours
            </li>
            <li>
              <Check size={15} />
              Moyennes glissantes connues à l'origine
            </li>
            <li>
              <Check size={15} />
              Heure, jour de semaine et saison
            </li>
            <li>
              <Check size={15} />
              Aucune observation postérieure à l'origine
            </li>
          </ul>
          <p className="panel-note">
            Hyperparamètres fixés avant le test. Le modèle n'est pas réentraîné
            sur la calibration.
          </p>
        </section>
      </div>
      <div className="limitation">
        <Info size={19} />
        <div>
          <strong>Ce que l'évaluation permet de dire</strong>
          <p>
            Ces résultats décrivent uniquement les deux mois de test.
            L'intervalle utilise les résidus de septembre–octobre : sa
            couverture future n'est pas garantie, notamment lors de changements
            de saison ou d'événements inhabituels. Cette démo ne fournit pas de
            prévisions opérationnelles.
          </p>
        </div>
      </div>
    </>
  );
}

function Methodology({ meta }) {
  const q = meta.quality,
    m = meta.model;
  return (
    <div className="methodology">
      <div className="forecast-intro">
        <div>
          <span className="section-label">
            <Database size={15} /> DONNÉES & MÉTHODE
          </span>
          <h2>Des chiffres que l'on peut vérifier.</h2>
          <p>
            Source publique, transformations explicites et évaluation
            reproductible.
          </p>
        </div>
        <a
          className="primary-button"
          href={sourceLink}
          target="_blank"
          rel="noreferrer"
        >
          Explorer la source RTE
          <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="method-grid">
        <section className="panel">
          <div className="source-logo">
            <Radio size={23} />
            <span>
              RTE <small>éCO2mix</small>
            </span>
            <span className="subtle-tag">OPEN DATA</span>
          </div>
          <h3>France · 2023–2024</h3>
          <p>
            Consommation, production par filière et estimation des émissions de
            la production électrique française. Les données sont téléchargées
            depuis la plateforme ODRÉ.
          </p>
          <dl>
            <div>
              <dt>Observations source</dt>
              <dd>{fmt(q.source_rows)}</dd>
            </div>
            <div>
              <dt>Heures agrégées</dt>
              <dd>{fmt(q.hourly_rows)}</dd>
            </div>
            <div>
              <dt>Horodatages dupliqués</dt>
              <dd>{q.duplicate_timestamps}</dd>
            </div>
            <div>
              <dt>Heures de consommation manquantes</dt>
              <dd>{q.missing_consumption_hours}</dd>
            </div>
            <div>
              <dt>Heures de CO₂ manquantes</dt>
              <dd>{q.missing_carbon_hours}</dd>
            </div>
            <div>
              <dt>Cellules de production manquantes</dt>
              <dd>{q.missing_fuel_cells}</dd>
            </div>
            <div>
              <dt>Licence des données</dt>
              <dd>
                <a href={meta.license_url} target="_blank" rel="noreferrer">
                  Etalab 2.0 <ExternalLink size={12} />
                </a>
              </dd>
            </div>
          </dl>
        </section>
        <section className="panel">
          <p className="eyebrow">DE LA SOURCE À L'ÉCRAN</p>
          <h2>Une chaîne de données lisible</h2>
          <div className="pipeline-list">
            {[
              [
                "01",
                "Collecter",
                "Export de l’API officielle. Cache brut et empreinte SHA-256.",
              ],
              [
                "02",
                "Contrôler",
                "Unicité des instants, valeurs manquantes et deux mesures par heure.",
              ],
              [
                "03",
                "Structurer",
                "Agrégation en UTC, stockage Parquet et SQLite, vues SQL.",
              ],
              [
                "04",
                "Évaluer",
                "Entraînement, calibration et test séparés dans le temps.",
              ],
              [
                "05",
                "Explorer",
                "Instantané JSON embarqué, sans appel externe au chargement.",
              ],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel definitions">
        <p className="eyebrow">CONVENTIONS DE CALCUL</p>
        <h2>Les définitions derrière les indicateurs</h2>
        <div className="definition-grid">
          <div>
            <h3>Puissance et énergie</h3>
            <p>
              Les valeurs horaires sont des moyennes en MW. La somme des
              moyennes sur des heures complètes donne l'énergie en MWh. Le
              tableau de bord la convertit en TWh.
            </p>
          </div>
          <div>
            <h3>Mix de production</h3>
            <p>
              Les huit filières de production constituent le dénominateur. Le
              pompage et les échanges frontaliers sont exclus. Le mix ne
              représente donc pas directement l'électricité consommée.
            </p>
          </div>
          <div>
            <h3>Renouvelables</h3>
            <p>
              Éolien, solaire, hydraulique et bioénergies. La part est calculée
              à partir de l'énergie produite ; le nucléaire participe au total
              mais pas aux renouvelables.
            </p>
          </div>
          <div>
            <h3>Intensité carbone</h3>
            <p>
              Moyenne du taux RTE pondérée par la production horaire. Il s'agit
              de l'indicateur d'émissions de production de RTE, pas d'une
              analyse complète de cycle de vie ni d'une empreinte de
              consommation.
            </p>
          </div>
          <div>
            <h3>Heure de Paris</h3>
            <p>
              Stockage et décalages du modèle en UTC, affichage Europe/Paris.
              Les journées de changement d'heure comptent 23 ou 25 heures.
              Aucune interpolation de la consommation manquante.
            </p>
          </div>
          <div>
            <h3>Prévision à 24 heures</h3>
            <p>
              Pour chaque heure cible t, la moyenne horaire la plus récente
              commence à t − 25 h et est complète à t − 24 h. Le modèle suppose
              ces mesures déjà disponibles à cet instant ; les délais
              opérationnels de publication ne sont pas simulés.
            </p>
          </div>
        </div>
      </section>
      <section className="panel reproducibility">
        <div>
          <p className="eyebrow">REPRODUCTIBILITÉ</p>
          <h2>Du code aux mêmes résultats.</h2>
          <p>
            Le dépôt contient le pipeline, les vues SQL, les tests, les
            paramètres du modèle et le manifeste de provenance.
          </p>
          <a
            href="https://github.com/Badreddine05/gridpulse"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Voir le dépôt GitHub
            <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="code-block">
          <span>python pipeline/build_dataset.py</span>
          <span>python -m pytest tests/</span>
          <span>npm ci && npm test && npm run build</span>
        </div>
      </section>
      <p className="hash-note">
        Empreinte du fichier source <code>{meta.source.sha256}</code>
      </p>
      <p className="disclosure">
        Projet personnel de Badreddine Channoufi, réalisé avec assistance IA.
        Données RTE sous Licence Ouverte. Les dates des données décrivent la
        période analysée, pas l'ancienneté du développement.
      </p>
    </div>
  );
}

function App() {
  const [raw, setRaw] = useState(null),
    [error, setError] = useState(null),
    [tab, setTab] = useState("overview"),
    [year, setYear] = useState(2024),
    [month, setMonth] = useState(12),
    [day, setDay] = useState("2024-12-11"),
    [toast, setToast] = useState(false),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/gridpulse.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setRaw)
      .catch((e) => setError(e.message));
  }, []);
  const rows = useMemo(() => (raw ? decodeData(raw) : []), [raw]);
  const selection = useMemo(
    () => selectRows(rows, year, month),
    [rows, year, month],
  );
  const hero = useRef(null);
  useEffect(() => {
    if (raw && hero.current) {
      const el = hero.current;
      el.classList.remove("is-shown");
      void el.offsetHeight;
      el.classList.add("is-shown");
    }
  }, [raw]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(false), 3500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  function exportCsv() {
    const selected =
      tab === "forecast" ? rows.filter((r) => r.prediction != null) : selection;
    const blob = new Blob(["\ufeff" + csvForRows(selected)], {
      type: "text/csv;charset=utf-8",
    });
    const href = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = href;
    a.download =
      tab === "forecast"
        ? "gridpulse-test-nov-dec-2024.csv"
        : `gridpulse-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    setToast(true);
  }
  const changeMonth = (value) => {
    setMonth(Number(value));
    setDay(`${year}-${String(value).padStart(2, "0")}-11`);
  };
  const changeYear = (value) => {
    setYear(Number(value));
    setDay(`${value}-${String(month).padStart(2, "0")}-11`);
  };
  function navigate(value) {
    setTab(value);
    setMenu(false);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  if (error)
    return (
      <div className="loading-screen">
        <Zap size={32} />
        <h1>Les données n'ont pas pu être chargées.</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>Réessayer</button>
      </div>
    );
  if (!raw)
    return (
      <div className="loading-screen" role="status">
        <Zap size={34} />
        <h1>GridPulse</h1>
        <p>Chargement de l'instantané RTE…</p>
        <div className="loading-track" />
      </div>
    );
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
          aria-label="GridPulse, accueil"
        >
          <span className="brand-icon">
            <Zap size={21} fill="currentColor" />
          </span>
          <span>
            grid<span className="brand-light">pulse</span>
            <small>ENERGY INTELLIGENCE</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Fermer le menu"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <p className="nav-label">ESPACE D'EXPLORATION</p>
        <nav aria-label="Navigation principale">
          {[
            ["overview", Activity, "Vue d’ensemble"],
            ["forecast", ChartNoAxesCombined, "Prévisions"],
            ["method", Database, "Données & méthode"],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => navigate(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {tab === id ? <i /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-context">
          <div className="france-mark">FR</div>
          <div>
            <strong>France métropolitaine</strong>
            <span>Réseau électrique national</span>
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="dataset-badge">
            <span className="status-dot" />
            <span>INSTANTANÉ HISTORIQUE</span>
          </div>
          <p>
            Janvier 2023 — décembre 2024
            <br />
            Données publiques RTE
          </p>
          <a
            href="https://github.com/Badreddine05/gridpulse"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} />
            Code & documentation
            <ArrowUpRight size={14} />
          </a>
          <div className="author">
            <span>BC</span>
            <div>
              <strong>Badreddine Channoufi</strong>
              <small>Data Engineering · MIAGE</small>
            </div>
          </div>
        </div>
      </aside>
      {menu ? (
        <button
          className="menu-overlay"
          aria-label="Fermer le menu"
          onClick={() => setMenu(false)}
        />
      ) : null}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Ouvrir le menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Observatoire</span>
            <ChevronRight size={13} />
            <strong>
              {tab === "overview"
                ? "Vue d’ensemble"
                : tab === "forecast"
                  ? "Prévisions"
                  : "Données & méthode"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="source-chip">
              <span className="status-dot" />
              RTE / éCO2mix
            </span>
            <a
              href="https://badreddine05.github.io/"
              className="portfolio-link"
            >
              Portfolio
              <ArrowUpRight size={14} />
            </a>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div ref={hero} className="t-stagger">
              <p className="eyebrow t-stagger-line t-stagger-line--1">
                OBSERVATOIRE DE L'ÉLECTRICITÉ FRANÇAISE
              </p>
              <h1 className="t-stagger-line t-stagger-line--2">
                L'énergie, <span>en perspective.</span>
              </h1>
              <p className="page-description">
                Comprendre le réseau. Explorer ses rythmes. Mesurer ce que l'on
                peut prévoir.
              </p>
            </div>
            <button className="export-button" onClick={exportCsv}>
              <Download size={16} />
              Exporter les données
            </button>
          </div>
          {tab === "overview" ? (
            <div className="toolbar">
              <div className="section-label">
                <span className="live-ring" /> LE RÉSEAU EN CHIFFRES
                <span className="divider" />
                <span className="historical-label">Exploration historique</span>
              </div>
              <div className="filters">
                <label>
                  <span className="sr-only">Année</span>
                  <select
                    aria-label="Année"
                    value={year}
                    onChange={(e) => changeYear(e.target.value)}
                  >
                    <option value="2023">2023</option>
                    <option value="2024">2024</option>
                  </select>
                  <ChevronDown size={12} />
                </label>
                <label>
                  <CalendarDays size={14} />
                  <select
                    aria-label="Mois"
                    value={month}
                    onChange={(e) => changeMonth(e.target.value)}
                  >
                    {MONTHS.map((m, i) => (
                      <option value={i + 1} key={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} />
                </label>
              </div>
            </div>
          ) : null}
          {tab === "overview" ? (
            <Overview
              rows={rows}
              year={year}
              month={month}
              day={day}
              setDay={setDay}
              setMonth={setMonth}
              setYear={setYear}
              selection={selection}
            />
          ) : tab === "forecast" ? (
            <Forecast rows={rows} meta={raw.meta} />
          ) : (
            <Methodology meta={raw.meta} />
          )}
          <footer>
            <span>
              GridPulse <span className="footer-dot">/</span> Projet personnel
              de Badreddine Channoufi
            </span>
            <span>
              Données : RTE · Licence Ouverte 2.0{" "}
              <a
                href={sourceLink}
                target="_blank"
                rel="noreferrer"
                aria-label="Source des données RTE"
              >
                <ExternalLink size={12} />
              </a>
            </span>
          </footer>
        </main>
      </div>
      {toast ? (
        <div className="toast" role="status">
          <Check size={17} />
          Export CSV téléchargé
        </div>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
