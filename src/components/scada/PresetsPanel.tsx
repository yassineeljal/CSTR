'use client';

import { useRef, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { notifyPresetsChanged, usePresets } from '@/hooks/usePresets';
import {
  PresetError,
  deletePreset,
  exportPresetJson,
  parsePresetJson,
  savePreset,
  type StoredPreset,
} from '@/lib/presetsStorage';
import { useReactorStore } from '@/store/useReactorStore';
import { useSim } from './SimulationContext';

const btn =
  'rounded border border-line bg-panel-2 px-2 py-1 font-mono text-[11px] text-zinc-200 hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

/** Presets : sauvegarde locale, chargement, export/import JSON (S5-L11). */
export function PresetsPanel() {
  const sim = useSim();
  const presets = usePresets();
  const params = useReactorStore((s) => s.params);
  const pid = useReactorStore((s) => s.pid);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = (fn: () => string) => {
    try {
      setNotice({ tone: 'ok', text: fn() });
    } catch (e) {
      setNotice({
        tone: 'error',
        text: e instanceof PresetError ? e.message : 'Opération impossible.',
      });
    }
  };

  const apply = (p: Pick<StoredPreset, 'params' | 'pid' | 'name'>) => {
    sim?.setParams(p.params);
    sim?.setPid(p.pid);
    return `Preset « ${p.name} » chargé.`;
  };

  const onSave = () =>
    run(() => {
      const saved = savePreset(name, params, pid);
      notifyPresetsChanged();
      setName('');
      return `Preset « ${saved.name} » enregistré.`;
    });

  const onExport = () =>
    run(() => {
      const label = name.trim() || 'cstr-preset';
      const text = exportPresetJson(label, params, pid);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label.replace(/[^\w-]+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return 'Fichier exporté.';
    });

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 100_000) {
      setNotice({ tone: 'error', text: 'Fichier trop volumineux (max 100 Ko).' });
      return;
    }
    try {
      const parsed = parsePresetJson(await file.text());
      setNotice({ tone: 'ok', text: apply(parsed) });
    } catch (e) {
      setNotice({
        tone: 'error',
        text: e instanceof PresetError ? e.message : 'Lecture du fichier impossible.',
      });
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <Panel id="panel-presets" title="Presets">
      <div className="flex gap-1">
        <input
          aria-label="Nom du preset"
          placeholder="Nom du preset"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
          className="border-line bg-panel-2 focus-visible:outline-accent min-w-0 flex-1 rounded border px-2 py-1 font-mono text-xs text-zinc-100 focus-visible:outline focus-visible:outline-2"
        />
        <button type="button" className={btn} onClick={onSave} disabled={!name.trim()}>
          Enregistrer
        </button>
      </div>
      <div className="mt-1.5 flex gap-1">
        <button type="button" className={btn} onClick={onExport}>
          Exporter JSON
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => fileInput.current?.click()}
          disabled={!sim}
        >
          Importer JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Importer un preset JSON"
          className="sr-only"
          onChange={(e) => void onImport(e.target.files?.[0])}
        />
      </div>
      {notice && (
        <p
          role="status"
          data-testid="preset-notice"
          className={`mt-1.5 font-mono text-[11px] ${notice.tone === 'ok' ? 'text-ok' : 'text-alarm'}`}
        >
          {notice.text}
        </p>
      )}
      <ul className="mt-2 space-y-1" aria-label="Presets enregistrés" data-testid="preset-list">
        {presets.length === 0 && (
          <li className="text-muted font-mono text-[11px]">Aucun preset enregistré.</li>
        )}
        {presets.map((p) => (
          <li
            key={p.id}
            className="border-line bg-panel-2 flex items-center justify-between gap-1 rounded border px-2 py-1"
          >
            <span className="truncate font-mono text-[11px] text-zinc-200" title={p.name}>
              {p.name}
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                className={btn}
                disabled={!sim}
                onClick={() => run(() => apply(p))}
                aria-label={`Charger ${p.name}`}
              >
                Charger
              </button>
              <button
                type="button"
                className={btn}
                aria-label={`Supprimer ${p.name}`}
                onClick={() =>
                  run(() => {
                    deletePreset(p.id);
                    notifyPresetsChanged();
                    return `Preset « ${p.name} » supprimé.`;
                  })
                }
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
