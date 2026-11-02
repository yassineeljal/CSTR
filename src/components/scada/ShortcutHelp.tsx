import { Panel } from '@/components/ui/Panel';
import { SHORTCUT_HELP } from '@/lib/shortcuts';

export function ShortcutHelp() {
  return (
    <Panel id="panel-shortcuts" title="Raccourcis clavier">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
        {SHORTCUT_HELP.map((s) => (
          <div key={s.keys} className="contents">
            <dt>
              <kbd className="border-line bg-panel-2 rounded border px-1.5 py-0.5 text-zinc-200">
                {s.keys}
              </kbd>
            </dt>
            <dd className="text-muted">{s.label}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
