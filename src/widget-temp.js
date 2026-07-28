import { moonSVGDataURL } from "./moonsvg.js";

/**
 * Computes the time window for the 24-hour widget.
 * Past hours offset places 'now' just to the left of the graph.
 */
export function computeWidgetWindow(now = new Date(), pastHours = 2, totalHours = 24) {
  const xStart = new Date(now.getTime() - pastHours * 3600 * 1000);
  const xEnd = new Date(now.getTime() + (totalHours - pastHours) * 3600 * 1000);
  return {
    now,
    xStart,
    xEnd,
    xDomain: [xStart, xEnd],
  };
}

/**
 * Filters dataset rows to those relevant for the widget window (with padding).
 */
export function filterWidgetData(rows, xStart, xEnd) {
  if (!rows || !rows.length) return [];
  const padMs = 3600 * 1000;
  const minTime = xStart.getTime() - padMs;
  const maxTime = xEnd.getTime() + padMs;
  return rows.filter((r) => {
    const t = r.t instanceof Date ? r.t : new Date(r.t);
    const timeMs = t.getTime();
    return timeMs >= minTime && timeMs <= maxTime;
  });
}

/**
 * Finds the row closest to the current time for header/summary display.
 */
export function getCurrentTempSummary(rows, now = new Date()) {
  if (!rows || !rows.length) return null;
  const nowMs = now.getTime();
  let closest = rows[0];
  let minDiff = Math.abs(new Date(rows[0].t).getTime() - nowMs);

  for (let i = 1; i < rows.length; i++) {
    const diff = Math.abs(new Date(rows[i].t).getTime() - nowMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = rows[i];
    }
  }
  return closest;
}

/**
 * Helper to get [min, max] of array
 */
function extent(vals) {
  if (!vals || !vals.length) return [50, 80];
  let min = vals[0], max = vals[0];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] < min) min = vals[i];
    if (vals[i] > max) max = vals[i];
  }
  return [min, max];
}

/**
 * Helper to generate Date ticks every stepHours hours
 */
function generateHourTicks(xStart, xEnd, stepHours = 3) {
  const ticks = [];
  const start = new Date(xStart);
  start.setMinutes(0, 0, 0);
  let cur = start.getTime();
  const end = xEnd.getTime();
  const stepMs = stepHours * 3600 * 1000;
  while (cur <= end) {
    if (cur >= xStart.getTime()) {
      ticks.push(new Date(cur));
    }
    cur += stepMs;
  }
  return ticks;
}

/**
 * Builds Plot configuration object for Observable Plot
 */
export function buildWidgetPlotSpec({
  Plot,
  data,
  bands,
  xDomain,
  now = new Date(),
  width = 500,
  height = 180,
}) {
  const vals = data
    .flatMap((d) => [d.temperature, d.dewpoint, d.apparent])
    .filter((v) => v != null);
  const [lo, hi] = extent(vals);
  const pad = Math.max(3, (hi - lo) * 0.15);
  const yDomain = [Math.floor(lo - pad), Math.ceil(hi + pad)];

  const C = {
    temp: "var(--series-temp, #eb6834)",
    feels: "var(--series-feels, #1baf7a)",
    dew: "var(--series-dew, #2a78d6)",
    ink: "var(--theme-foreground, #333)",
    muted: "var(--theme-foreground-muted, #666)",
    faint: "var(--theme-foreground-faint, #ccc)",
  };

  const dayRects = bands?.days || [];
  const nightRects = bands?.nights || [];

  const moonBands = nightRects.filter((d) => {
    if (d.moonPhase == null) return false;
    const mid = (d.start.getTime() + d.end.getTime()) / 2;
    return mid >= xDomain[0].getTime() && mid <= xDomain[1].getTime();
  });

  const moonMarks = moonBands.map((d) => {
    const visStart = Math.max(d.start.getTime(), xDomain[0].getTime());
    const visEnd = Math.min(d.end.getTime(), xDomain[1].getTime());
    const mid = new Date((visStart + visEnd) / 2);
    const size = 18;
    const src = moonSVGDataURL(d.moonPhase, size, 0.8, "#ffffff");
    return Plot.image([d], {
      x: () => mid,
      y: yDomain[1],
      src,
      width: size,
      height: size,
      dy: size * 0.5,
    });
  });

  const tickHours = width < 350 ? 6 : 3;
  const gridTicks = generateHourTicks(xDomain[0], xDomain[1], 6);

  return {
    width,
    height,
    marginLeft: 36,
    marginRight: 16,
    marginTop: 18,
    marginBottom: 22,
    x: { type: "time", domain: xDomain, label: null },
    y: {
      domain: yDomain,
      label: "°F",
      grid: true,
      ticks: 4,
      tickSize: 0,
      nice: false,
    },
    style: { fontSize: "11px", background: "transparent" },
    marks: [
      // Day & Night background bands
      Plot.rect(dayRects, {
        x1: "start",
        x2: "end",
        y1: yDomain[0],
        y2: yDomain[1],
        fill: "var(--band-day, #ecd9a0)",
        fillOpacity: 0.08,
      }),
      Plot.rect(nightRects, {
        x1: "start",
        x2: "end",
        y1: yDomain[0],
        y2: yDomain[1],
        fill: "var(--band-night, #16162a)",
        fillOpacity: 0.25,
      }),

      // Grid rules
      Plot.ruleX(gridTicks, {
        stroke: C.faint,
        strokeWidth: 1,
        strokeOpacity: 0.3,
      }),
      Plot.axisX({
        ticks: generateHourTicks(xDomain[0], xDomain[1], tickHours),
        tickFormat: (t) => {
          const h = t.getHours();
          if (h === 0) {
            const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            return days[t.getDay()];
          }
          return `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;
        },
        tickSize: 0,
        fontSize: 10,
        color: C.muted,
      }),

      // Temperature series lines
      Plot.line(data, {
        x: "t",
        y: "dewpoint",
        stroke: C.dew,
        strokeWidth: 1.8,
        curve: "monotone-x",
      }),
      Plot.line(data, {
        x: "t",
        y: "apparent",
        stroke: C.feels,
        strokeWidth: 1.8,
        strokeDasharray: "3 3",
        curve: "monotone-x",
      }),
      Plot.line(data, {
        x: "t",
        y: "temperature",
        stroke: C.temp,
        strokeWidth: 2.5,
        curve: "monotone-x",
      }),

      ...moonMarks,

      // CURRENT TIME Vertical Indicator Line & Label (matching main app styling)
      Plot.ruleX([now], {
        x: (d) => d,
        stroke: C.muted,
        strokeWidth: 1,
        strokeOpacity: 0.5,
      }),
      Plot.text([now], {
        x: (d) => d,
        y: yDomain[1],
        dy: 6,
        text: () => "NOW",
        rotate: -90,
        fontSize: 10,
        fill: C.muted,
        fontWeight: 600,
        stroke: "var(--theme-background)",
        strokeWidth: 3,
        paintOrder: "stroke",
      }),

      // Hover Crosshair & Tooltip
      Plot.ruleX(data, Plot.pointerX({ x: "t", stroke: C.ink, strokeOpacity: 0.4 })),
      Plot.dot(data, Plot.pointerX({ x: "t", y: "temperature", r: 5, fill: C.temp })),
      Plot.tip(
        data,
        Plot.pointerX({
          x: "t",
          y: "temperature",
          fontSize: 11,
          title: (d) =>
            [
              d.t.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }),
              `Temp: ${d.temperature != null ? d.temperature + "°F" : "—"}`,
              d.apparent != null ? `Feels like: ${d.apparent}°F` : null,
              d.dewpoint != null ? `Dew point: ${d.dewpoint}°F` : null,
            ]
              .filter(Boolean)
              .join("\n"),
        })
      ),
    ],
  };
}
