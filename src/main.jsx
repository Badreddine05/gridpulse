import "./tokens.css";
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  MONTHS,
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

const NB = "\u00a0";
const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const MONTH_SHORT_FMT = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  timeZone: "UTC",
});
const dateLabel = (date) => DATE_FMT.format(new Date(date + "T12:00:00Z"));
const shortDate = (date) =>
  SHORT_DATE_FMT.format(new Date(date + "T12:00:00Z"));
const MONTH_SHORT = MONTHS.map((_, i) =>
  MONTH_SHORT_FMT.format(new Date(Date.UTC(2024, i, 15))),
);
const monthName = (month) => MONTHS[month - 1].toLowerCase();
const sourceLink =
  "https://odre.opendatasoft.com/explore/dataset/eco2mix-national-cons-def/";
const repoLink = "https://github.com/Badreddine05/gridpulse";

const VIEWS = [
  ["overview", "Vue d’ensemble"],
  ["forecast", "Prévisions"],
  ["method", "Données et méthode"],
];
const HEADINGS = {
  overview: {
    title: "Consommation et production d’électricité, France, 2023–2024",
    lead: "Moyennes horaires publiées par RTE (éCO2mix), de janvier 2023 à décembre 2024. Il s’agit d’un instantané historique : les valeurs ne sont pas mises à jour en direct.",
  },
  forecast: {
    title: "Prévision de la consommation à 24 heures",
    lead: "Le modèle prévoit la consommation de chaque heure 24 heures à l’avance. Il est évalué sur novembre et décembre 2024, deux mois exclus de l’entraînement et de la calibration.",
  },
  method: {
    title: "Données et méthode",
    lead: "D’où viennent les données et comment chaque indicateur est calculé.",
  },
};

/* Generation mix: fixed display order (nuclear, renewables, fossil) and
   theme-aware colours. Adjacent pairs were checked for colour-blind separation. */
const MIX = [
  { key: "nucleaire", color: "var(--ink)" },
  { key: "hydraulique", color: "var(--neuro)" },
  { key: "eolien", color: "var(--flow)" },
  { key: "solaire", color: "var(--grid)" },
  { key: "bioenergies", color: "var(--data-muted)" },
  { key: "gaz", color: "var(--retail)" },
  { key: "fioul", color: "var(--rule-2)" },
  { key: "charbon", color: "var(--ink-2)" },
];

/* Theme: Auto (system), then Clair, then Sombre, stored as "bc-theme". */
const THEME_KEY = "bc-theme";
const THEME_STEPS = [
  { value: null, label: "Auto" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];
function readStoredTheme() {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}
function storeTheme(theme) {
  try {
    if (theme) window.localStorage.setItem(THEME_KEY, theme);
    else window.localStorage.removeItem(THEME_KEY);
  } catch {
    /* Storage unavailable: the choice lasts for this page only. */
  }
}
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme) root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  metas.forEach((meta) => {
    if (!meta.dataset.default)
      meta.dataset.default = meta.getAttribute("content");
  });
  const forced = theme
    ? metas.find((meta) => (meta.getAttribute("media") || "").includes(theme))
    : null;
  metas.forEach((meta) =>
    meta.setAttribute(
      "content",
      forced ? forced.dataset.default : meta.dataset.default,
    ),
  );
}

function ThemeIcon({ mode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        fill={mode === "dark" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
      />
      {mode == null ? (
        <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
      ) : null}
    </svg>
  );
}

function ThemeButton() {
  const [theme, setTheme] = useState(readStoredTheme);
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      const stored = readStoredTheme();
      setTheme(stored);
      applyTheme(stored);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const index = Math.max(
    0,
    THEME_STEPS.findIndex((step) => step.value === theme),
  );
  const current = THEME_STEPS[index],
    next = THEME_STEPS[(index + 1) % THEME_STEPS.length];
  return (
    <button
      type="button"
      className="theme-button"
      onClick={() => {
        setTheme(next.value);
        applyTheme(next.value);
        storeTheme(next.value);
      }}
      aria-label={`Thème : ${current.label}. Passer au thème ${next.label.toLowerCase()}`}
      title={`Thème : ${current.label}`}
    >
      <ThemeIcon mode={theme} />
    </button>
  );
}

function GridPulseMark({ size = 22 }) {
  return (
    <svg
      className="mark"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 16C4.5 16 5.5 9 8.5 9c2 0 2.2 3.2 4.1 3.2 2.2 0 2.8-6.7 5.4-6.7 2.3 0 2.8 7 3.5 10.5" />
        <g fill="currentColor" stroke="none">
          <circle cx="3" cy="20.5" r="1" />
          <circle cx="7.5" cy="20.5" r="1" />
          <circle cx="12" cy="20.5" r="1" />
          <circle cx="16.5" cy="20.5" r="1" />
          <circle cx="21" cy="20.5" r="1" />
        </g>
      </g>
    </svg>
  );
}

function External() {
  return (
    <>
      <ArrowUpRight
        className="external-icon"
        size={14}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="sr-only"> (nouvel onglet)</span>
    </>
  );
}

function Key({ type }) {
  return (
    <svg
      className="key"
      width="20"
      height="10"
      viewBox="0 0 20 10"
      aria-hidden="true"
      focusable="false"
    >
      {type === "band" ? (
        <rect x="0" y="1" width="20" height="8" className="band" />
      ) : (
        <line x1="1" x2="19" y1="5" y2="5" className={`key-line key-${type}`} />
      )}
    </svg>
  );
}

function Figure({ label, value, unit, context }) {
  return (
    <div className="figure">
      <dt>{label}</dt>
      <dd className="figure-value">
        <span className="figure-number">{value}</span>
        {unit ? <span className="figure-unit">{unit}</span> : null}
      </dd>
      {context ? <dd className="figure-context">{context}</dd> : null}
    </div>
  );
}

/* Charts are drawn at the container's real pixel width so that axis text
   stays at 11 px on every screen instead of being scaled with a viewBox.
   The width is measured before the first paint; until then nothing is drawn. */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function hourlyTicks(data) {
  const seen = new Set(),
    ticks = [];
  data.forEach((r, i) => {
    const hour = Number(r.time.slice(0, 2));
    if (hour % 6 === 0 && !seen.has(hour)) {
      seen.add(hour);
      ticks.push(i);
    }
  });
  const last = data.length - 1;
  if (!ticks.length || last - ticks[ticks.length - 1] >= 3) ticks.push(last);
  return ticks;
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
  const [ref, width] = useWidth();
  const all = data
    .flatMap((r) => [
      r.consommation,
      forecast ? r.upper : null,
      forecast ? r.lower : null,
      forecast && baseline ? r.baseline : null,
    ])
    .filter(Number.isFinite);
  if (!all.length)
    return (
      <div ref={ref} className="chart">
        <p className="empty">Aucune mesure pour cette sélection.</p>
      </div>
    );
  if (!width) return <div ref={ref} className="chart" />;
  const compact = width < 560;
  const w = Math.max(width, 240),
    h = daily ? (compact ? 260 : 340) : compact ? 230 : 300,
    pad = { l: 34, r: 8, t: 24, b: 30 };
  const lo = Math.floor((Math.min(...all) - 3000) / 10000) * 10000,
    hi = Math.ceil((Math.max(...all) + 3000) / 10000) * 10000;
  const n = data.length;
  const x = (i) => pad.l + (i / (n - 1 || 1)) * (w - pad.l - pad.r),
    y = (v) => h - pad.b - ((v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
  const line = (key) =>
    data
      .map((r, i) =>
        Number.isFinite(r[key])
          ? `${i === 0 || !Number.isFinite(data[i - 1]?.[key]) ? "M" : "L"}${x(i)},${y(r[key])}`
          : "",
      )
      .join(" ");
  const active = hover ?? Math.min(cursor ?? n - 1, n - 1),
    point = data[active];
  const step = (hi - lo) / 10000 > 6 ? 20000 : 10000;
  const ticks = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  const xTicks = daily
    ? [
        ...new Set(
          compact
            ? [0, Math.round((n - 1) / 2), n - 1]
            : [
                0,
                Math.round((n - 1) / 4),
                Math.round((n - 1) / 2),
                Math.round((n - 1) * 0.75),
                n - 1,
              ],
        ),
      ]
    : hourlyTicks(data);
  const validBand = data.every(
    (r) => Number.isFinite(r.lower) && Number.isFinite(r.upper),
  );
  const band = validBand
    ? data.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.upper)}`).join(" ") +
      [...data]
        .reverse()
        .map((r, j) => `L${x(n - 1 - j)},${y(r.lower)}`)
        .join(" ") +
      "Z"
    : "";
  const slot = (w - pad.l - pad.r) / (n - 1 || 1);
  const drawKey = data[0]?.timestamp ?? data[0]?.date;
  return (
    <div ref={ref} className="chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        role="img"
        aria-label={
          forecast
            ? "Consommation observée, prévision et intervalle calibré en gigawatts"
            : "Consommation horaire observée en gigawatts"
        }
        onMouseLeave={() => setHover(null)}
      >
        <text
          x={pad.l - 8}
          y="10"
          textAnchor="end"
          className="axis-label axis-unit"
        >
          GW
        </text>
        {ticks.map((t) => {
          const ty = Math.round(y(t)) + 0.5;
          return (
            <g key={t}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={ty}
                y2={ty}
                className="grid-line"
              />
              <text
                x={pad.l - 8}
                y={ty}
                dy="0.32em"
                textAnchor="end"
                className="axis-label"
              >
                {fmt(t / 1000)}
              </text>
            </g>
          );
        })}
        {xTicks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={h - 8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            className="axis-label"
          >
            {daily ? shortDate(data[i].date) : data[i].time}
          </text>
        ))}
        {forecast && band ? <path d={band} className="band" /> : null}
        {forecast && baseline ? (
          <path d={line("baseline")} className="line line-baseline" />
        ) : null}
        {forecast ? (
          <path
            key={`forecast-${drawKey}`}
            d={line("prediction")}
            pathLength="1"
            className="line line-forecast line-draw"
          />
        ) : null}
        <path
          key={`observed-${drawKey}`}
          d={line("consommation")}
          pathLength="1"
          className="line line-observed line-draw"
        />
        {point && Number.isFinite(point.consommation) ? (
          <g
            className="chart-cursor"
            style={{ transform: `translateX(${x(active)}px)` }}
            aria-hidden="true"
          >
            <line
              x1="0"
              x2="0"
              y1={pad.t}
              y2={h - pad.b}
              className="cursor-line"
            />
            {forecast && Number.isFinite(point.prediction) ? (
              <circle
                cx="0"
                cy={y(point.prediction)}
                r="4"
                className="cursor-dot is-forecast"
              />
            ) : null}
            <circle
              cx="0"
              cy={y(point.consommation)}
              r="4.5"
              className="cursor-dot"
            />
          </g>
        ) : null}
        {data.map((r, i) => (
          <rect
            key={i}
            x={x(i) - slot / 2}
            y={pad.t}
            width={slot}
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
      <p className="chart-readout">
        <span className="readout-time">
          {daily ? shortDate(point.date) : point.time}
        </span>
        <span>
          <Key type="observed" />
          <b>{fmt(gw(point.consommation), 2)}</b> GW observés
        </span>
        {forecast && point.prediction != null ? (
          <span>
            <Key type="forecast" />
            <b>{fmt(point.prediction / 1000, 2)}</b> GW prévus
          </span>
        ) : null}
      </p>
    </div>
  );
}

function Mix({ rows, caption }) {
  const sum = summary(rows);
  const byKey = Object.fromEntries(sum.fuels.map((f) => [f.key, f]));
  const fuels = MIX.map((m) => ({ ...byKey[m.key], color: m.color }));
  const head = (
    <header className="panel-head">
      <div className="panel-title">
        <p className="fig-label">Fig. 2</p>
        <h2 className="fig-title" id="fig-mix">
          Mix de production
        </h2>
        <p className="panel-desc">{caption}</p>
      </div>
    </header>
  );
  if (!sum.productionHours) {
    return (
      <section className="panel mix-panel" aria-labelledby="fig-mix">
        {head}
        <div className="empty">
          <p>Mesures absentes pour cette heure.</p>
          <p className="empty-note">
            Le mix n’est pas calculé sans données complètes.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="panel mix-panel" aria-labelledby="fig-mix">
      {head}
      <p className="mix-total">
        <span className="figure-number">{fmt(sum.renewable, 1)}</span>
        <span className="figure-unit">%</span>
        <span className="mix-total-label">renouvelable</span>
      </p>
      <div className="mix-bar" aria-hidden="true">
        {fuels.map((f) => (
          <span
            key={f.key}
            className={f.share > 0 ? "has-value" : undefined}
            style={{ flexGrow: f.share * 1000, background: f.color }}
          />
        ))}
      </div>
      <ul className="mix-legend">
        {fuels.map((f) => (
          <li key={f.key}>
            <span className="mix-name">
              <i className="swatch" style={{ background: f.color }} />
              {f.label}
            </span>
            <span className="num">
              {fmt(f.share * 100, 1)}
              {NB}%
            </span>
          </li>
        ))}
      </ul>
      <p className="panel-foot">
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
  const weeks = Math.ceil((offset + data.length) / 7);
  const monthStarts = MONTHS.map((_, i) => {
    const index = data.findIndex(
      (d) => d.date.slice(5, 7) === String(i + 1).padStart(2, "0"),
    );
    return index < 0 ? null : Math.floor((offset + index) / 7);
  });
  const shade = (t) =>
    `color-mix(in oklab, var(--grid) ${Math.round(t * 100)}%, var(--paper-3))`;
  const scrollRef = useRef(null);
  useEffect(() => {
    /* On narrow screens the year scrolls sideways: keep the selected day visible. */
    const box = scrollRef.current;
    if (!box || box.scrollWidth <= box.clientWidth) return;
    const cell = box.querySelector(".heatmap-cell.selected");
    if (!cell) return;
    const b = box.getBoundingClientRect(),
      c = cell.getBoundingClientRect();
    if (c.left < b.left || c.right > b.right)
      box.scrollLeft += c.left - b.left - (b.width - c.width) / 2;
  }, [selected, year]);
  return (
    <section className="panel calendar-panel" aria-labelledby="fig-calendar">
      <header className="panel-head">
        <div className="panel-title">
          <p className="fig-label">Fig. 3</p>
          <h2 className="fig-title" id="fig-calendar">
            Pointe journalière de consommation, {year}
          </h2>
          <p className="panel-desc">
            Maximum horaire de chaque jour, en GW. Cliquer sur un jour pour
            explorer sa courbe.
          </p>
        </div>
      </header>
      <div className="heatmap-scroll" ref={scrollRef}>
        <div className="heatmap" style={{ "--weeks": weeks }}>
          <div className="heatmap-months" aria-hidden="true">
            {MONTH_SHORT.map((m, i) =>
              monthStarts[i] == null ? null : (
                <span
                  key={m}
                  style={{ gridColumn: `${monthStarts[i] + 1} / span 4` }}
                >
                  {m}
                </span>
              ),
            )}
          </div>
          <div className="heatmap-days" aria-hidden="true">
            <span>lun.</span>
            <span />
            <span>mer.</span>
            <span />
            <span>ven.</span>
            <span />
            <span />
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
                className={
                  "heatmap-cell" + (selected === d.date ? " selected" : "")
                }
                aria-pressed={selected === d.date}
                style={{
                  background: shade((d.peak - min) / (max - min || 1)),
                }}
                aria-label={`${dateLabel(d.date)}, pointe ${fmt(d.peak / 1000, 1)} GW`}
                title={`${dateLabel(d.date)} · ${fmt(d.peak / 1000, 1)} GW`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend">
        <span className="ramp-scale">
          <span>
            {fmt(min / 1000)}
            {NB}GW
          </span>
          <span className="ramp" aria-hidden="true">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <i key={t} style={{ background: shade(t) }} />
            ))}
          </span>
          <span>
            {fmt(max / 1000)}
            {NB}GW
          </span>
        </span>
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
  const prevMonth = month === 1 ? 12 : month - 1,
    prevYear = month === 1 ? year - 1 : year;
  const dayDate = actualDay[0]?.date;
  return (
    <>
      <dl className="figures">
        <Figure
          label="Consommation du mois"
          value={fmt(sum.energy, 2)}
          unit="TWh"
          context={
            delta == null
              ? "Énergie consommée"
              : `${delta < 0 ? "−" : "+"}${fmt(Math.abs(delta), 1)}${NB}% par rapport à ${monthName(prevMonth)} ${prevYear}`
          }
        />
        <Figure
          label="Pointe de consommation"
          value={fmt(sum.peak, 1)}
          unit="GW"
          context="Maximum horaire du mois"
        />
        <Figure
          label="Production renouvelable"
          value={fmt(sum.renewable, 1)}
          unit="%"
          context="Éolien, solaire, hydraulique, bio"
        />
        <Figure
          label="Intensité carbone"
          value={fmt(sum.carbon, 1)}
          unit={
            <>
              gCO<sub>2</sub>/kWh
            </>
          }
          context="Moyenne pondérée par la production"
        />
      </dl>
      <div className="split day-layout">
        <section className="panel day-panel" aria-labelledby="fig-day">
          <header className="panel-head">
            <div className="panel-title">
              <p className="fig-label">Fig. 1</p>
              <h2 className="fig-title" id="fig-day">
                Consommation horaire{dayDate ? `, ${dateLabel(dayDate)}` : ""}
              </h2>
              <p className="panel-desc">
                Puissance moyenne de chaque heure, en GW, heure de Paris.
              </p>
            </div>
            <label className="field">
              <span className="field-label">Jour</span>
              <span className="select">
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
                <ChevronDown size={16} aria-hidden="true" />
              </span>
            </label>
          </header>
          <div className="day-meta">
            <p className="readout-main">
              <span className="readout-value">
                {fmt(gw(selected?.consommation), 1)}
              </span>
              <span className="figure-unit">GW</span>
              <span className="readout-at">à {selected?.time}</span>
            </p>
            <div className="legend">
              <span className="legend-item">
                <Key type="observed" />
                Observé
              </span>
              {hasForecast ? (
                <button
                  type="button"
                  className="legend-toggle"
                  aria-pressed={showForecast}
                  onClick={() => setShowForecast(!showForecast)}
                >
                  <span className="checkbox" aria-hidden="true">
                    {showForecast ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <Key type="forecast" />
                  Prévision J+24{NB}h
                </button>
              ) : null}
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
              type="button"
              className={
                "icon-button play-button" + (playing ? " playing" : "")
              }
              aria-label={playing ? "Mettre en pause" : "Lire la journée"}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? (
                <Pause size={16} aria-hidden="true" />
              ) : (
                <Play size={16} aria-hidden="true" />
              )}
            </button>
            <input
              className="range"
              aria-label="Heure explorée"
              aria-valuetext={selected?.time}
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
              type="button"
              className="icon-button"
              aria-label="Revenir à minuit"
              onClick={() => {
                setPlaying(false);
                setCursor(0);
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="chart-note">
            <span>Moyennes horaires · heure de Paris</span>
            <span>
              {actualDay.length} observations
              {hasForecast && showForecast
                ? ` · intervalle calibré · nominal${NB}90${NB}%`
                : hasForecast
                  ? ""
                  : " · prévisions du 4 novembre au 31 décembre 2024"}
            </span>
          </p>
        </section>
        <Mix
          rows={selected ? [selected] : []}
          caption={
            selected
              ? `${dateLabel(selected.date)} à ${selected.time}`
              : "Aucune observation"
          }
        />
      </div>
      <Calendar rows={rows} year={year} onSelect={chooseDate} selected={day} />
      <div className="split lower-layout">
        <section className="panel monthly-panel" aria-labelledby="fig-months">
          <header className="panel-head">
            <div className="panel-title">
              <p className="fig-label">Fig. 4</p>
              <h2 className="fig-title" id="fig-months">
                Consommation mensuelle, {year}
              </h2>
              <p className="panel-desc">
                Énergie consommée chaque mois, en TWh. Cliquer sur un mois pour
                le sélectionner.
              </p>
            </div>
          </header>
          <div className="monthly-bars">
            {MONTHS.map((m, i) => {
              const value = summary(selectRows(rows, year, i + 1)).energy;
              return (
                <button
                  type="button"
                  className={"month-bar" + (month === i + 1 ? " active" : "")}
                  aria-pressed={month === i + 1}
                  aria-label={`${m} ${year} : ${fmt(value, 2)} TWh`}
                  onClick={() => {
                    setMonth(i + 1);
                    setDay(`${year}-${String(i + 1).padStart(2, "0")}-11`);
                  }}
                  key={m}
                  title={`${m} ${year} : ${fmt(value, 2)} TWh`}
                >
                  <span className="bar-value">{fmt(value, 1)}</span>
                  <i style={{ height: `${(value / 55) * 140}px` }} />
                  <span className="bar-label" data-initial={m[0]}>
                    {MONTH_SHORT[i]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="panel note" aria-labelledby="note-title">
          <h2 className="section-title" id="note-title">
            Un instantané historique
          </h2>
          <p className="prose">
            Ces chiffres décrivent 2023 et 2024 à partir des données publiques
            de RTE. Ce n’est pas une mesure en direct du réseau.
          </p>
          <p className="prose">
            Les prévisions de novembre et décembre 2024 sont évaluées sur des
            observations exclues de l’entraînement.
          </p>
          <p className="note-source">
            Source publique :{" "}
            <a href={sourceLink} target="_blank" rel="noreferrer">
              RTE, éCO2mix
              <External />
            </a>
          </p>
        </aside>
      </div>
      <details className="data-table">
        <summary>
          <span>Consulter les valeurs de la journée</span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Valeurs horaires{dayDate ? ` du ${dateLabel(dayDate)}` : ""}
            </caption>
            <thead>
              <tr>
                <th scope="col">Heure (Paris)</th>
                <th scope="col" className="num">
                  Consommation (MW)
                </th>
                <th scope="col" className="num">
                  Prévision (MW)
                </th>
                <th scope="col" className="num">
                  CO<sub>2</sub> (g/kWh)
                </th>
              </tr>
            </thead>
            <tbody>
              {actualDay.map((r) => (
                <tr key={r.timestamp}>
                  <td className="time">{r.time}</td>
                  <td className="num">{fmt(r.consommation, 1)}</td>
                  <td className="num">{fmt(r.prediction, 1)}</td>
                  <td className="num">{fmt(r.taux_co2, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

const PERIODS = [
  ["all", "Novembre et décembre 2024"],
  ["2024-11", "Novembre 2024"],
  ["2024-12", "Décembre 2024"],
];

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
  const periodLabel = PERIODS.find(([value]) => value === period)[1];
  return (
    <>
      <div className="controls">
        <label className="field">
          <span className="field-label">Période évaluée</span>
          <span className="select">
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>
      </div>
      <dl className="figures">
        <Figure
          label="Erreur absolue moyenne"
          value={fmt(mae / 1000, 2)}
          unit="GW"
          context={`${fmt(test.length)} heures évaluées`}
        />
        <Figure
          label="Erreur du modèle de référence"
          value={fmt(baseMae / 1000, 2)}
          unit="GW"
          context="Même heure, une semaine avant"
        />
        <Figure
          label="Écart d’erreur vs référence"
          value={(gain >= 0 ? "−" : "+") + fmt(Math.abs(gain), 1)}
          unit="%"
          context={
            gain >= 0 ? "Erreur moyenne réduite" : "Erreur moyenne supérieure"
          }
        />
        <Figure
          label="Couverture de l’intervalle"
          value={fmt(coverage, 2)}
          unit="%"
          context={`Niveau nominal${NB}: 90${NB}%`}
        />
      </dl>
      <section className="panel forecast-panel" aria-labelledby="fig-forecast">
        <header className="panel-head">
          <div className="panel-title">
            <p className="fig-label">Fig. 1</p>
            <h2 className="fig-title" id="fig-forecast">
              Prévision et consommation observée sur la période de test
            </h2>
            <p className="panel-desc">
              Moyennes journalières en GW, {periodLabel.toLowerCase()}.
            </p>
          </div>
          <button
            type="button"
            className="button button-secondary toggle-button"
            aria-pressed={baseline}
            onClick={() => setBaseline(!baseline)}
          >
            <span className="checkbox" aria-hidden="true">
              {baseline ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            Afficher la référence
          </button>
        </header>
        <ul className="legend chart-legend">
          <li className="legend-item">
            <Key type="observed" />
            Consommation observée
          </li>
          <li className="legend-item">
            <Key type="forecast" />
            Prévision à 24{NB}h
          </li>
          {baseline ? (
            <li className="legend-item">
              <Key type="baseline" />
              Référence hebdomadaire
            </li>
          ) : null}
          <li className="legend-item">
            <Key type="band" />
            Intervalle calibré, nominal 90{NB}%
          </li>
        </ul>
        <Chart data={days} forecast daily baseline={baseline} />
        <p className="panel-foot">
          Courbes : moyennes journalières des valeurs horaires. Les erreurs et
          la couverture ci-dessus sont calculées heure par heure. L’intervalle
          affiché est la moyenne des bornes horaires, sans garantie de
          couverture journalière.
        </p>
      </section>
      <div className="split model-layout">
        <section className="panel split-panel" aria-labelledby="fig-split">
          <header className="panel-head">
            <div className="panel-title">
              <p className="fig-label">Fig. 2</p>
              <h2 className="fig-title" id="fig-split">
                Découpage chronologique des données
              </h2>
              <p className="panel-desc">
                Les trois périodes se suivent dans le temps, sans chevauchement.
              </p>
            </div>
          </header>
          <div className="split-track" aria-hidden="true">
            <span className="split-train" />
            <span className="split-cal" />
            <span className="split-test" />
          </div>
          <ul className="split-legend">
            <li>
              <b>
                <i className="swatch split-train" />
                Entraînement
              </b>
              <span>janv. 2023 – août 2024</span>
              <small>{fmt(metrics.train_rows)} heures valides</small>
            </li>
            <li>
              <b>
                <i className="swatch split-cal" />
                Calibration
              </b>
              <span>sept. – oct. 2024</span>
              <small>{fmt(metrics.calibration_rows)} heures</small>
            </li>
            <li>
              <b>
                <i className="swatch split-test" />
                Test final
              </b>
              <span>nov. – déc. 2024</span>
              <small>{fmt(metrics.test_rows)} heures</small>
            </li>
          </ul>
        </section>
        <section className="panel model-panel" aria-labelledby="model-title">
          <h2 className="section-title" id="model-title">
            Modèle : gradient boosting
          </h2>
          <p className="model-id">
            {metrics.model} · horizon {metrics.horizon_hours}
            {NB}h
          </p>
          <ul className="feature-list">
            <li>
              Consommation passée{NB}: 25{NB}h à 14{NB}jours
            </li>
            <li>Moyennes glissantes connues à l’origine</li>
            <li>Heure, jour de semaine et saison</li>
            <li>Aucune observation postérieure à l’origine</li>
          </ul>
          <p className="panel-foot">
            Hyperparamètres fixés avant le test. Le modèle n’est pas réentraîné
            sur la calibration.
          </p>
        </section>
      </div>
      <aside className="caveat" aria-labelledby="caveat-title">
        <h2 className="section-title" id="caveat-title">
          Ce que l’évaluation permet de dire
        </h2>
        <p className="prose">
          Ces résultats décrivent uniquement les deux mois de test. L’intervalle
          utilise les résidus de septembre–octobre : sa couverture future n’est
          pas garantie, notamment lors de changements de saison ou d’événements
          inhabituels. Cette démo ne fournit pas de prévisions opérationnelles.
        </p>
      </aside>
    </>
  );
}

function Methodology({ meta }) {
  const q = meta.quality;
  return (
    <div className="methodology">
      <div className="split method-layout">
        <section className="panel source-panel" aria-labelledby="source-title">
          <h2 className="section-title" id="source-title">
            RTE éCO2mix, France, 2023–2024
          </h2>
          <p className="prose">
            Consommation, production par filière et estimation des émissions de
            la production électrique française. Les données sont téléchargées
            depuis la plateforme ODRÉ.
          </p>
          <a
            className="button button-primary"
            href={sourceLink}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir le jeu de données RTE
            <External />
          </a>
          <dl className="facts">
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
              <dt>
                Heures de CO<sub>2</sub> manquantes
              </dt>
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
                  Etalab 2.0
                  <External />
                </a>
              </dd>
            </div>
          </dl>
        </section>
        <section
          className="panel pipeline-panel"
          aria-labelledby="pipeline-title"
        >
          <h2 className="section-title" id="pipeline-title">
            De la source à l’écran
          </h2>
          <ol className="steps">
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
            ].map(([number, title, text]) => (
              <li key={number}>
                <span className="step-number">{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section
        className="panel definitions-panel"
        aria-labelledby="definitions-title"
      >
        <h2 className="section-title" id="definitions-title">
          Définitions des indicateurs
        </h2>
        <div className="definition-grid">
          <div>
            <h3>Puissance et énergie</h3>
            <p>
              Les valeurs horaires sont des moyennes en MW. La somme des
              moyennes sur des heures complètes donne l’énergie en MWh. Le
              tableau de bord la convertit en TWh.
            </p>
          </div>
          <div>
            <h3>Mix de production</h3>
            <p>
              Les huit filières de production constituent le dénominateur. Le
              pompage et les échanges frontaliers sont exclus. Le mix ne
              représente donc pas directement l’électricité consommée.
            </p>
          </div>
          <div>
            <h3>Renouvelables</h3>
            <p>
              Éolien, solaire, hydraulique et bioénergies. La part est calculée
              à partir de l’énergie produite ; le nucléaire participe au total
              mais pas aux renouvelables.
            </p>
          </div>
          <div>
            <h3>Intensité carbone</h3>
            <p>
              Moyenne du taux RTE pondérée par la production horaire. Il s’agit
              de l’indicateur d’émissions de production de RTE, pas d’une
              analyse complète de cycle de vie ni d’une empreinte de
              consommation.
            </p>
          </div>
          <div>
            <h3>Heure de Paris</h3>
            <p>
              Stockage et décalages du modèle en UTC, affichage Europe/Paris.
              Les journées de changement d’heure comptent 23 ou 25 heures.
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
      <section className="split repro-layout" aria-labelledby="repro-title">
        <div className="panel">
          <h2 className="section-title" id="repro-title">
            Reproduire les résultats
          </h2>
          <p className="prose">
            Le dépôt contient le pipeline, les vues SQL, les tests, les
            paramètres du modèle et le manifeste de provenance.
          </p>
          <a
            href={repoLink}
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Voir le dépôt GitHub
            <External />
          </a>
        </div>
        <div className="panel">
          <pre className="code-block">
            <code>
              <span>python pipeline/build_dataset.py</span>
              <span>python -m pytest tests/</span>
              <span>npm ci && npm test && npm run build</span>
            </code>
          </pre>
        </div>
      </section>
      <p className="hash-note">
        Empreinte SHA-256 du fichier source <code>{meta.source.sha256}</code>
      </p>
      <p className="disclosure">
        Projet personnel de Badreddine Channoufi, réalisé avec assistance IA.
        Données RTE sous Licence Ouverte. Les dates des données décrivent la
        période analysée, pas l’ancienneté du développement.
      </p>
    </div>
  );
}

/* The tab row scrolls sideways on narrow phones: keep the active or focused
   view, and its focus ring, inside the visible part of the row. */
function revealTab(el) {
  const bar = el?.parentElement;
  if (!bar || bar.scrollWidth <= bar.clientWidth) return;
  const b = bar.getBoundingClientRect(),
    a = el.getBoundingClientRect();
  if (a.left < b.left + 16) bar.scrollLeft += a.left - b.left - 16;
  else if (a.right > b.right - 16) bar.scrollLeft += a.right - b.right + 16;
}

function App() {
  const [raw, setRaw] = useState(null),
    [error, setError] = useState(null),
    [tab, setTab] = useState("overview"),
    [year, setYear] = useState(2024),
    [month, setMonth] = useState(12),
    [day, setDay] = useState("2024-12-11"),
    [toast, setToast] = useState(false);
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
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(false), 3500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const tabsRef = useRef(null);
  useEffect(() => {
    revealTab(tabsRef.current?.querySelector(".tab.active"));
  }, [tab, raw]);
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
        <GridPulseMark size={32} />
        <h1>Les données n’ont pas pu être chargées.</h1>
        <p className="loading-detail">{error}</p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => location.reload()}
        >
          Réessayer
        </button>
      </div>
    );
  if (!raw)
    return (
      <div className="loading-screen" role="status">
        <GridPulseMark size={32} />
        <h1>GridPulse</h1>
        <p>Chargement de l’instantané RTE…</p>
      </div>
    );
  const heading = HEADINGS[tab];
  const exportScope =
    tab === "forecast"
      ? "période de test, novembre et décembre 2024"
      : `${monthName(month)} ${year}`;
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="topbar-start">
            <a
              className="brand"
              href="./"
              onClick={(e) => {
                e.preventDefault();
                navigate("overview");
              }}
              aria-label="GridPulse, accueil"
            >
              <GridPulseMark />
              <span className="brand-name">GridPulse</span>
            </a>
            <a className="author-link" href="../">
              Badreddine Channoufi
            </a>
          </div>
          <div className="topbar-end">
            <nav className="topbar-links" aria-label="Liens du projet">
              <a href="../projets/gridpulse/">Étude de cas</a>
              <a href={repoLink} target="_blank" rel="noreferrer">
                Code
                <External />
              </a>
            </nav>
            <ThemeButton />
          </div>
        </div>
      </header>
      <nav className="tabs" aria-label="Vues de l’application">
        <div className="container tabs-inner" ref={tabsRef}>
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={"tab" + (tab === id ? " active" : "")}
              onClick={() => navigate(id)}
              onFocus={(e) => revealTab(e.currentTarget)}
              aria-current={tab === id ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <main id="main" className="container" tabIndex={-1}>
        <div className="page-head">
          <div className="page-title">
            <h1>{heading.title}</h1>
            <p className="lead">{heading.lead}</p>
          </div>
          <button
            type="button"
            className="button button-secondary export-button"
            onClick={exportCsv}
            aria-label={`Exporter en CSV : ${exportScope}`}
            title={`Exporter en CSV : ${exportScope}`}
          >
            <Download size={16} aria-hidden="true" />
            Exporter en CSV
          </button>
        </div>
        {tab === "overview" ? (
          <div className="controls">
            <label className="field">
              <span className="field-label">Année</span>
              <span className="select">
                <select
                  aria-label="Année"
                  value={year}
                  onChange={(e) => changeYear(e.target.value)}
                >
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Mois</span>
              <span className="select">
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
                <ChevronDown size={16} aria-hidden="true" />
              </span>
            </label>
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
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <p>
            GridPulse · projet personnel de{" "}
            <a href="../">Badreddine Channoufi</a>
          </p>
          <p>
            Instantané historique 2023–2024 · données{" "}
            <a href={sourceLink} target="_blank" rel="noreferrer">
              RTE éCO2mix
              <External />
            </a>
            ,{" "}
            <a href={raw.meta.license_url} target="_blank" rel="noreferrer">
              Licence Ouverte 2.0
              <External />
            </a>
          </p>
        </div>
      </footer>
      {toast ? (
        <div className="toast" role="status">
          <Check size={16} aria-hidden="true" />
          Export CSV téléchargé
        </div>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
