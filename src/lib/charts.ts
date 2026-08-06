/* Canvas chart engine — evolved from the v1 PK visualizer.
   DPR-aware, theme-aware, smooth curves, no dependencies.
   Line charts (PK/occupancy/dose-response) + bar charts (AE frequency). */

export interface Pt {
  t: number;
  c: number;
}

export interface ChartSeries {
  label: string;
  color?: string;
  points: Pt[];
  dashed?: boolean;
  fill?: boolean;
}

export interface ChartOpts {
  height?: number;
  xLabel?: string;
  yLabel?: string;
  xMax?: number;
  yMax?: number;
  unitX?: string;
  unitY?: string;
  yFmt?: (v: number) => string;
  xFmt?: (v: number) => string;
  showLegend?: boolean;
}

interface ThemeColors {
  border: string;
  faint: string;
  muted: string;
  text: string;
  grid: string;
}

function readTheme(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const g = (v: string, fb: string) => s.getPropertyValue(v).trim() || fb;
  return {
    border: g('--border-strong', 'rgba(232,238,243,0.16)'),
    faint: g('--text-faint', '#5C6878'),
    muted: g('--text-muted', '#91A0B2'),
    text: g('--text', '#E9EEF3'),
    grid: g('--border', 'rgba(232,238,243,0.08)'),
  };
}

function fit(canvas: HTMLCanvasElement, h: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(280, rect.width);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

export function drawLineChart(canvas: HTMLCanvasElement, series: ChartSeries[], opts: ChartOpts = {}): void {
  const h = opts.height ?? 260;
  const ctx = fit(canvas, h);
  const theme = readTheme();
  const w = Math.max(280, canvas.getBoundingClientRect().width);

  const pad = { l: 48, r: 14, t: 16, b: 34 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const allX = series.flatMap((s) => s.points.map((p) => p.t));
  const allY = series.flatMap((s) => s.points.map((p) => p.c));
  const maxT = opts.xMax ?? (allX.length ? Math.max(...allX) : 24);
  const maxC = opts.yMax ?? (allY.length ? niceCeil(Math.max(...allY, 0.01)) : 10);

  const X = (t: number) => pad.l + (t / maxT) * plotW;
  const Y = (c: number) => pad.t + plotH - (c / maxC) * plotH;

  /* grid + axes */
  ctx.font = '10.5px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const v = (maxC / yTicks) * i;
    const y = Y(v);
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    ctx.fillStyle = theme.faint;
    const label = opts.yFmt ? opts.yFmt(v) : `${round(v)}`;
    ctx.fillText(label, pad.l - 7, y);
  }
  const xTicks = 6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= xTicks; i++) {
    const t = (maxT / xTicks) * i;
    const x = X(t);
    ctx.strokeStyle = theme.grid;
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + plotH);
    ctx.stroke();
    ctx.fillStyle = theme.faint;
    const label = opts.xFmt ? opts.xFmt(t) : `${round(t)}${opts.unitX ?? 'h'}`;
    ctx.fillText(label, x, pad.t + plotH + 8);
  }

  /* series */
  series.forEach((s, si) => {
    const color = s.color ?? seriesColor(si);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(s.dashed ? [5, 4] : []);
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = X(p.t);
      const y = Y(p.c);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prev = s.points[i - 1];
        const mx = (X(prev.t) + x) / 2;
        ctx.quadraticCurveTo(X(prev.t), Y(prev.c), mx, (Y(prev.c) + y) / 2);
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);

    if (s.fill) {
      ctx.lineTo(X(s.points[s.points.length - 1].t), Y(0));
      ctx.lineTo(X(s.points[0].t), Y(0));
      ctx.closePath();
      ctx.fillStyle = hexA(color, 0.10);
      ctx.fill();
    }
  });

  /* axis labels */
  ctx.fillStyle = theme.faint;
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (opts.xLabel) ctx.fillText(opts.xLabel, pad.l + plotW / 2, h - 14);
  ctx.save();
  ctx.translate(13, pad.t + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  if (opts.yLabel) ctx.fillText(opts.yLabel, 0, 0);
  ctx.restore();

  /* legend */
  if (opts.showLegend && series.length > 1) {
    let x = pad.l;
    ctx.font = '11px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const s of series) {
      const color = s.color ?? seriesColor(series.indexOf(s));
      const label = s.label;
      const lw = ctx.measureText(label).width;
      if (x + 14 + lw > w - pad.r) break;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, h - 20);
      ctx.lineTo(x + 12, h - 20);
      ctx.stroke();
      ctx.fillStyle = theme.muted;
      ctx.fillText(label, x + 17, h - 20);
      x += 17 + lw + 18;
    }
  }
}

export function drawBarChart(
  canvas: HTMLCanvasElement,
  bars: Array<{ label: string; value: number; color?: string }>,
  opts: ChartOpts = {}
): void {
  const h = opts.height ?? 220;
  const ctx = fit(canvas, h);
  const theme = readTheme();
  const w = Math.max(280, canvas.getBoundingClientRect().width);
  const pad = { l: 40, r: 10, t: 14, b: 40 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const maxV = opts.yMax ?? niceCeil(Math.max(...bars.map((b) => b.value), 1));

  ctx.font = '10.5px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = (maxV / 4) * i;
    const y = pad.t + plotH - (v / maxV) * plotH;
    ctx.strokeStyle = theme.grid;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    ctx.fillStyle = theme.faint;
    ctx.fillText(`${opts.yFmt ? opts.yFmt(v) : round(v)}`, pad.l - 6, y);
  }

  const slot = plotW / bars.length;
  const barW = Math.min(40, slot * 0.6);
  bars.forEach((b, i) => {
    const x = pad.l + slot * i + (slot - barW) / 2;
    const bh = (b.value / maxV) * plotH;
    const y = pad.t + plotH - bh;
    ctx.fillStyle = b.color ?? seriesColor(i);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, [4, 4, 0, 0]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.faint;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = b.label.length > 14 ? b.label.slice(0, 13) + '…' : b.label;
    ctx.fillText(label, x + barW / 2, pad.t + plotH + 6);
  });
}

/* ---------- helpers ---------- */

const SERIES_PALETTE = ['#3ED9C5', '#9B8CFB', '#F0876B', '#E8B554', '#5FA8F5', '#6FD6A8', '#F26D6D', '#7EC8F2', '#B48CFA', '#E5739A'];
let paletteIdx = 0;
export function seriesColor(i: number): string {
  return SERIES_PALETTE[i % SERIES_PALETTE.length];
}
export function nextSeriesColor(): string {
  return SERIES_PALETTE[paletteIdx++ % SERIES_PALETTE.length];
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function hexA(hex: string, a: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
