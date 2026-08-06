/* PK Visualizer lab — four panels: single dose, multiple dose
   (steady-state accumulation), dose–response (Hill), receptor occupancy.
   Evolved from the v1 engine with real drug presets where available. */

import { el } from '../lib/dom';
import { registerView } from '../lib/router';
import { MONOGRAPHS } from '../lib/catalog';
import { sectionHead, disclaimerBox, tabRow } from './components';
import {
  drawLineChart, nextSeriesColor,
} from '../lib/charts';
import {
  seriesOral, seriesMultiDose, halfLifeToKe, tPeak, cPeak,
  hillEffect, receptorOccupancy, cAvgSS, accumulationRatio,
} from '../lib/pk';

export function register(): void {
  registerView('pk', 'PK Visualizer', (root) => {
    root.appendChild(sectionHead(
      'Pharmacokinetics lab',
      'PK Visualizer',
      'Single-dose kinetics, steady-state accumulation, dose–response (Hill equation), and receptor occupancy — drawn as curves, not just numbers. Presets load real monograph half-lives where available.'
    ));

    root.appendChild(tabRow([
      { label: 'Single dose', render: () => singleDosePanel() },
      { label: 'Multiple dose', render: () => multiDosePanel() },
      { label: 'Dose–response', render: () => doseResponsePanel() },
      { label: 'Receptor occupancy', render: () => occupancyPanel() },
    ]));

    root.appendChild(disclaimerBox('Illustrative model output — one-compartment kinetics with first-order absorption. Real drug behavior may differ; use for learning the shapes, not for dosing.'));

    function drugPresetSelect(placeholder: string): HTMLSelectElement {
      return el('select', { class: 'filter-select', 'aria-label': placeholder },
        el('option', { value: '' }, placeholder),
        ...MONOGRAPHS.filter((m) => parseFloat(m.pharmacokinetics?.halfLife ?? '') > 0)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => el('option', { value: m.id }, `${m.name} (t½ ${m.pharmacokinetics!.halfLife})`))) as HTMLSelectElement;
    }

    function presetFrom(id: string): { ka: number; ke: number; dose: number; F: number; Vd: number; label: string } | null {
      const m = MONOGRAPHS.find((x) => x.id === id);
      if (!m) return null;
      const hl = parseFloat(m.pharmacokinetics?.halfLife ?? '');
      if (!(hl > 0)) return null;
      const F = Math.min(1, Math.max(0.05, (parseFloat(m.pharmacokinetics?.bioavailability ?? '') || 80) / 100));
      const Vd = Math.max(5, parseFloat(m.pharmacokinetics?.volumeOfDistribution ?? '') || 30);
      return { ka: 1.2, ke: halfLifeToKe(hl), dose: 40, F, Vd, label: m.name };
    }

    function singleDosePanel(): HTMLElement {
      const p = el('div', {});
      const preset = drugPresetSelect('Load a real drug…');
      const ctl = el('div', { class: 'filters' }, preset);
      const canvas = el('canvas', { style: 'width:100%;display:block;' }) as HTMLCanvasElement;
      const readout = el('div', { class: 'pill-list', style: 'margin-top:12px' });
      p.appendChild(ctl);
      p.appendChild(canvas);
      p.appendChild(readout);

      const params = { ka: 1.0, ke: 0.35, dose: 100, F: 0.8, Vd: 30 };
      const redraw = () => {
        const pp = { ...params };
        const tMax = Math.min(72, Math.max(24, (Math.LN2 / pp.ke) * 5));
        drawLineChart(canvas, [{ label: 'Plasma conc.', points: seriesOral(pp, tMax), color: nextSeriesColor(), fill: true }], {
          xLabel: 'Time (h)', yLabel: 'Conc (mg/L)', height: 260, xMax: tMax,
        });
        const tp = tPeak(pp);
        const cp = cPeak(pp);
        const hl = Math.LN2 / pp.ke;
        readout.innerHTML = '';
        readout.append(
          pill(`Cmax ${cp.toFixed(1)} mg/L`),
          pill(`tmax ${tp.toFixed(1)} h`),
          pill(`t½ ${hl.toFixed(1)} h`),
          pill(`AUC 0–∞ ${(cp * tp * 0.5 + cp / pp.ke).toFixed(0)} mg·h/L`));
      };
      preset.addEventListener('change', () => {
        const pr = presetFrom(preset.value);
        if (pr) {
          params.ka = pr.ka; params.ke = pr.ke; params.dose = pr.dose; params.F = pr.F; params.Vd = pr.Vd;
          redraw();
        }
      });
      redraw();
      return p;
    }

    function multiDosePanel(): HTMLElement {
      const p = el('div', {});
      const preset = drugPresetSelect('Load a real drug…');
      const ctl = el('div', { class: 'filters' }, preset);
      const canvas = el('canvas', { style: 'width:100%;display:block;' }) as HTMLCanvasElement;
      const readout = el('div', { class: 'pill-list', style: 'margin-top:12px' });
      p.appendChild(ctl);
      p.appendChild(canvas);
      p.appendChild(readout);

      const params = { ka: 1.0, ke: 0.35, dose: 100, F: 0.8, Vd: 30, interval: 24, doses: 5 };
      const redraw = () => {
        const pp = { ka: params.ka, ke: params.ke, dose: params.dose, F: params.F, Vd: params.Vd };
        const tMax = params.interval * params.doses + Math.min(24, 4 * Math.LN2 / params.ke);
        const series = seriesMultiDose(pp, params.interval, params.doses, tMax);
        drawLineChart(canvas, [{ label: `Dose every ${params.interval}h`, points: series, color: nextSeriesColor(), fill: true }], {
          xLabel: 'Time (h)', yLabel: 'Conc (mg/L)', height: 260, xMax: tMax,
        });
        const css = cAvgSS(pp, params.interval);
        const ar = accumulationRatio(pp, params.interval);
        readout.innerHTML = '';
        readout.append(
          pill(`Css,avg ${css.toFixed(2)} mg/L`),
          pill(`Accumulation ratio ${ar.toFixed(2)}`),
          pill(`Weeks to SS ≈ ${(Math.log(1 - 0.9) / -params.ke / 24).toFixed(1)} d`));
      };
      preset.addEventListener('change', () => {
        const pr = presetFrom(preset.value);
        if (pr) {
          params.ka = pr.ka; params.ke = pr.ke; params.dose = pr.dose; params.F = pr.F; params.Vd = pr.Vd;
          redraw();
        }
      });
      redraw();
      return p;
    }

    function doseResponsePanel(): HTMLElement {
      const p = el('div', {});
      const canvas = el('canvas', { style: 'width:100%;display:block;' }) as HTMLCanvasElement;
      const sliders = el('div', { style: 'display:flex;gap:22px;flex-wrap:wrap;margin-bottom:16px' },
        sliderRow('EC₅₀', 1, 100, 1, 30, (v) => `${v.toFixed(0)} mg`),
        sliderRow('Hill coefficient', 0.5, 4, 0.1, 1.2, (v) => v.toFixed(1)));
      p.appendChild(sliders);
      p.appendChild(canvas);
      const vals = { ec50: 30, hill: 1.2 };
      sliders.querySelectorAll('input').forEach((input, i) => {
        input.addEventListener('input', () => {
          if (i === 0) vals.ec50 = parseFloat(input.value);
          else vals.hill = parseFloat(input.value);
          redraw();
        });
      });
      const redraw = () => {
        const concs: number[] = [];
        for (let i = 0; i <= 100; i++) concs.push((i / 100) * 200);
        const points = concs.map((c) => ({ t: c, c: hillEffect(c, vals.ec50, vals.hill) }));
        drawLineChart(canvas, [{ label: 'Effect', points, color: nextSeriesColor() }], {
          xLabel: 'Concentration (mg/L)', yLabel: 'Effect (0–1)', height: 260,
          yMax: 1, yFmt: (v) => v.toFixed(1),
        });
      };
      redraw();
      return p;
    }

    function occupancyPanel(): HTMLElement {
      const p = el('div', {});
      const canvas = el('canvas', { style: 'width:100%;display:block;' }) as HTMLCanvasElement;
      p.appendChild(canvas);
      const redraw = () => {
        const concs: number[] = [];
        for (let i = 0; i <= 200; i++) concs.push((i / 200) * 20);
        const series = [1, 2.5, 5, 10].map((kd) => ({
          label: `Kd ${kd} µM`,
          points: concs.map((c) => ({ t: c, c: receptorOccupancy(c, kd) })),
          color: nextSeriesColor(),
        }));
        drawLineChart(canvas, series, {
          xLabel: 'Ligand concentration (µM)', yLabel: 'Occupancy (0–1)', height: 260,
          yMax: 1, yFmt: (v) => v.toFixed(1), showLegend: true,
        });
      };
      redraw();
      return p;
    }
  });
}

function pill(text: string): HTMLElement {
  return el('span', { class: 'pill' }, text);
}

function sliderRow(label: string, min: number, max: number, step: number, value: number, fmt: (v: number) => string): HTMLElement {
  const wrap = el('label', { style: 'display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--text-muted)' },
    el('span', {}, `${label} — <span class="mono" style="color:var(--text)">${fmt(value)}</span>`),
    el('input', { type: 'range', min, max, step, value }));
  return wrap;
}
