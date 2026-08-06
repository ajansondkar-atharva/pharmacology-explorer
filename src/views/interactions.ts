/* Interaction Checker — pair picker → engine resolution with
   severity, mechanism, management, evidence, and source attribution. */

import { el } from '../lib/dom';
import { registerView } from '../lib/router';
import { MONOGRAPHS } from '../lib/catalog';
import { checkPair, severityLabel, type InteractionFinding } from '../lib/interactions';
import { sectionHead, emptyState, disclaimerBox } from './components';

const SEV_CLASS: Record<string, string> = {
  contraindicated: 'sev-contraindicated',
  major: 'sev-major',
  moderate: 'sev-moderate',
  minor: 'sev-minor',
};

const SOURCE_LABEL: Record<string, string> = {
  pair: 'Curated pair (v1)',
  monograph: 'Monograph record',
  rule: 'Class-level mechanistic rule',
};

export function register(): void {
  registerView('interactions', 'Interaction Checker', (root) => {
    root.appendChild(sectionHead(
      'Drug–drug analysis',
      'Interaction Checker',
      'Pick two agents. The engine resolves static pairs, monograph-level records, and class-level mechanistic rules — every finding explains the why, the management, and the evidence. A silent result is not a guarantee of safety.'
    ));

    const drugs = [...MONOGRAPHS].sort((a, b) => a.name.localeCompare(b.name));
    const makeSelect = (label: string) => el('select', {
      class: 'filter-select', style: 'min-width:220px', 'aria-label': label,
    }, el('option', { value: '' }, label + '…'),
      ...drugs.map((d) => el('option', { value: d.id }, d.name)));

    const s1 = makeSelect('Agent A') as HTMLSelectElement;
    const s2 = makeSelect('Agent B') as HTMLSelectElement;
    const resultBox = el('div', { style: 'margin-top:18px' });

    const selRow = el('div', { class: 'card', style: 'display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin-bottom:18px' },
      el('div', { style: 'display:flex;flex-direction:column;gap:6px' },
        el('span', { class: 'field-label' }, 'Agent A'), s1),
      el('div', { style: 'display:flex;flex-direction:column;gap:6px' },
        el('span', { class: 'field-label' }, 'Agent B'), s2),
      el('button', { class: 'btn btn-primary', id: 'ixCheck' }, 'Check interaction'));
    root.appendChild(selRow);

    const run = () => {
      if (!s1.value || !s2.value) {
        resultBox.innerHTML = '';
        resultBox.appendChild(emptyState('', 'Select both agents to check.'));
        return;
      }
      if (s1.value === s2.value) {
        resultBox.innerHTML = '';
        resultBox.appendChild(emptyState('', 'Pick two different agents.'));
        return;
      }
      const res = checkPair(s1.value, s2.value);
      resultBox.innerHTML = '';
      const aName = drugs.find((d) => d.id === s1.value)?.name ?? s1.value;
      const bName = drugs.find((d) => d.id === s2.value)?.name ?? s2.value;

      if (!res.findings.length) {
        resultBox.appendChild(el('div', { class: 'interaction-card' },
          el('h4', {},
            el('span', { class: 'sev sev-minor' }, 'No interaction found'),
            el('span', {}, `${aName} + ${bName}`)),
          el('div', { class: 'prose' },
            'No interaction is recorded in the current knowledge base for this pair. This means the pair is either genuinely low-risk or simply unstudied/not yet catalogued — it is not a safety guarantee. Consult the product labels and a pharmacist for high-stakes combinations.')));
        return;
      }

      res.findings.forEach((f: InteractionFinding) => {
        const card = el('div', { class: 'interaction-card' },
          el('h4', {},
            el('span', { class: `sev ${SEV_CLASS[f.severity] ?? 'sev-moderate'}` }, severityLabel(f.severity)),
            el('span', {}, `${f.a === s1.value ? aName : bName} + ${f.a === s1.value ? bName : aName}`)),
          el('div', { class: 'interaction-grid' },
            el('div', { class: 'ix-block' }, el('span', { class: 'ix-label' }, 'Why it matters'), el('div', { class: 'prose' }, f.summary)),
            f.mechanism ? el('div', { class: 'ix-block' }, el('span', { class: 'ix-label' }, 'Mechanism'), el('div', { class: 'prose' }, f.mechanism)) : null,
            f.management ? el('div', { class: 'ix-block' }, el('span', { class: 'ix-label' }, 'Management'), el('div', { class: 'prose' }, f.management)) : null,
            f.evidence ? el('div', { class: 'ix-block' }, el('span', { class: 'ix-label' }, 'Evidence'), el('div', { class: 'prose' }, f.evidence)) : null),
          el('div', { style: 'margin-top:12px;font-size:11px;color:var(--text-faint);font-family:var(--font-mono)' },
            `Source: ${SOURCE_LABEL[f.source] ?? f.source}${f.ruleId ? ` (${f.ruleId})` : ''}`));
        resultBox.appendChild(card);
      });
    };

    ($('#ixCheck') as HTMLElement).addEventListener('click', run);
    s1.addEventListener('change', run);
    s2.addEventListener('change', run);
    root.appendChild(resultBox);
    root.appendChild(disclaimerBox('Interaction analysis is a study aid, not clinical decision support. Severity ratings reflect the knowledge base’s curated rules and records — always verify against current labels and a clinical pharmacist.'));
  });
}

function $(sel: string): HTMLElement | null {
  return document.querySelector(sel);
}
