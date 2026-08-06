/* Sync panel — run/hash-based update detection, per-source status,
   attribution. Reachable from the sidebar sync badge or palette. */

import { el } from '../lib/dom';
import { registerView } from '../lib/router';
import { sectionHead, disclaimerBox } from './components';
import {
  SYNC_SOURCES, runSync, loadSyncState, resetSource, type SyncReport,
} from '../lib/sync';
import { applySyncedOverlays } from '../lib/catalog';
import { getSynced } from '../lib/store';
import { toast } from '../lib/toast';
import { buildSearchIndex } from '../lib/search';

export function register(): void {
  registerView('sync', 'Sync', (root) => {
    root.appendChild(sectionHead(
      'Background updater',
      'Synchronization',
      'Hash-based update detection against trusted public APIs. Changed records are validated, merged into the local overlay, and never overwrite validated base data or your personal notes.'
    ));

    const statusEl = el('div', { class: 'stat-row' });
    const sourcesEl = el('div', { style: 'margin-top:10px' });
    const logEl = el('div', { style: 'margin-top:18px' });
    root.appendChild(statusEl);
    root.appendChild(sourcesEl);
    root.appendChild(logEl);

    const syncBtn = el('button', { class: 'btn btn-primary' }, 'Run sync now') as HTMLButtonElement;
    root.appendChild(syncBtn);
    root.appendChild(disclaimerBox('Attribution — OpenFDA: data provided by the U.S. Food and Drug Administration (openFDA), public API, rate-limited. RxNorm: data from the National Library of Medicine (public UMLS subset). Sync only ever runs when you trigger it or enable auto-sync.'));

    async function refresh(): Promise<void> {
      const state = await loadSyncState();
      const synced = await getSynced();
      const bySource = new Map<string, number>();
      synced.forEach((r) => bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1));

      statusEl.innerHTML = '';
      statusEl.appendChild(statTile(String(synced.length), 'overlay records stored'));
      statusEl.appendChild(statTile(
        state.lastRun ? new Date(state.lastRun).toLocaleString() : 'never',
        'last sync'));
      statusEl.appendChild(statTile(String(state.reports.length), 'runs recorded'));

      sourcesEl.innerHTML = '';
      for (const def of SYNC_SOURCES) {
        const last = state.reports.find((r) => r.source === def.id);
        const card = el('div', { class: 'interaction-card' },
          el('h4', {},
            el('span', {}, def.label),
            el('span', { class: 'pill', style: 'margin-left:auto' }, `${bySource.get(def.id) ?? 0} records`)),
          el('div', { class: 'prose' }, def.description),
          def.attribution ? el('div', { class: 'text-faint', style: 'font-size:11.5px;margin-top:8px' }, def.attribution) : null,
          last ? el('div', { class: 'text-faint', style: 'font-size:11.5px;margin-top:8px;font-family:var(--font-mono)' },
            `last run ${new Date(last.finishedAt).toLocaleString()} · checked ${last.stats.checked} · changed ${last.stats.changed} · failed ${last.stats.failed}${last.error ? ` · error: ${last.error}` : ''}`) : null,
          el('div', { style: 'margin-top:10px' },
            el('button', { class: 'btn btn-ghost btn-sm', onclick: () => void resetSource(def.id).then(refresh) }, 'Clear stored records')));
        sourcesEl.appendChild(card);
      }

      logEl.innerHTML = '';
      const recent = state.reports.slice(0, 5);
      if (recent.length) {
        const list = el('div', { class: 'ref-list' });
        recent.forEach((r) => {
          list.appendChild(el('div', { class: 'ref-item' },
            el('span', { class: 'ref-n' }, r.source),
            el('span', {}, `${new Date(r.finishedAt).toLocaleString()} — checked ${r.stats.checked}, changed ${r.stats.changed}, stored ${r.stats.totalStored}${r.error ? `, ERROR: ${r.error}` : ''}`)));
        });
        logEl.appendChild(el('div', { class: 'field-label', style: 'margin-bottom:8px' }, 'Recent runs'));
        logEl.appendChild(list);
      }
    }

    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      syncBtn.textContent = 'Syncing…';
      logEl.innerHTML = '';
      const progress = el('div', { class: 'progress', style: 'margin:12px 0' });
      const fill = el('div', { style: 'width:0%' });
      progress.appendChild(fill);
      logEl.appendChild(progress);
      const plabel = el('div', { class: 'text-faint', style: 'font-size:12px;margin-bottom:8px' }, 'Starting…');
      logEl.prepend(plabel);

      const reports = await runSync(
        SYNC_SOURCES.map((s) => s.id),
        (_src, done, total, label) => {
          fill.style.width = `${Math.round((done / total) * 100)}%`;
          plabel.textContent = `[${done}/${total}] ${label}`;
        },
        async (done: SyncReport[]) => {
          const ok = done.filter((r) => !r.error);
          const failed = done.filter((r) => r.error);
          await applySyncedOverlays();
          buildSearchIndex();
          toast(`Sync complete — ${ok.length} source(s) updated${failed.length ? `, ${failed.length} failed` : ''}`, failed.length ? 'warn' : 'ok', 3500);
          syncBtn.disabled = false;
          syncBtn.textContent = 'Run sync now';
          await refresh();
        }
      );
      void reports;
    });

    void refresh();
  });
}

function statTile(num: string, label: string): HTMLElement {
  return el('div', { class: 'stat-tile' },
    el('div', { class: 'stat-num', style: num.length > 14 ? 'font-size:17px' : undefined }, num),
    el('div', { class: 'stat-label' }, label));
}
