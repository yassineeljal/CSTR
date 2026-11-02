'use client';

import { useEffect, useRef } from 'react';
import Markdown, { type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { useReactorStore } from '@/store/useReactorStore';
import { SHEETS, getSheet } from './sheets';

/** Styles des éléments Markdown (aucune classe de typographie globale : thème SCADA sombre). */
const components: Components = {
  h2: ({ children }) => (
    <h3 className="text-accent mt-4 mb-1.5 font-mono text-[13px] font-semibold tracking-wide first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="my-2 text-[13px] leading-relaxed text-zinc-300">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-[13px] text-zinc-300">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-[13px] text-zinc-300">{children}</ol>
  ),
  strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  em: ({ children }) => <em className="text-zinc-200">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-warn bg-panel-2 my-3 border-l-2 px-3 py-1 text-[12px] text-zinc-300">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-panel-2 rounded px-1 font-mono text-[12px] text-zinc-200">{children}</code>
  ),
};

/**
 * Tiroir latéral des fiches théoriques (S6-L03) : Markdown + formules KaTeX. Ouvert par les
 * étiquettes 3D ou le bouton « Théorie » ; se ferme avec Échap. Le contenu est statique et
 * rendu sans HTML brut (react-markdown échappe tout HTML).
 */
export function TheoryDrawer() {
  const sheetId = useReactorStore((s) => s.ui.theorySheet);
  const patchUi = useReactorStore((s) => s.patchUi);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sheetId) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') patchUi({ theorySheet: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetId, patchUi]);

  if (!sheetId) return null;
  const sheet = getSheet(sheetId);

  return (
    <aside
      role="dialog"
      aria-label={`Fiche théorique : ${sheet.title}`}
      data-testid="theory-drawer"
      className="border-line bg-panel/97 absolute top-0 right-0 bottom-0 z-30 flex w-[min(520px,94%)] flex-col border-l shadow-2xl backdrop-blur"
    >
      <header className="border-line flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="text-muted font-mono text-xs font-semibold tracking-widest uppercase">
          Théorie
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={() => patchUi({ theorySheet: null })}
          aria-label="Fermer la fiche"
          className="border-line bg-panel-2 hover:bg-line focus-visible:outline-accent rounded border px-2 py-0.5 font-mono text-xs text-zinc-200 focus-visible:outline focus-visible:outline-2"
        >
          ✕
        </button>
      </header>
      <nav aria-label="Fiches" className="border-line flex flex-wrap gap-1 border-b p-2">
        {SHEETS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === sheetId}
            onClick={() => patchUi({ theorySheet: s.id })}
            className={`focus-visible:outline-accent rounded border px-2 py-1 font-mono text-[11px] focus-visible:outline focus-visible:outline-2 ${s.id === sheetId ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel-2 text-muted hover:text-zinc-200'}`}
          >
            {s.title}
          </button>
        ))}
      </nav>
      <article className="min-h-0 flex-1 overflow-y-auto px-4 py-3" data-testid="theory-content">
        <h2 className="mb-1 text-base font-semibold text-zinc-100">{sheet.title}</h2>
        <p className="text-muted mb-2 text-xs">{sheet.summary}</p>
        <Markdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={components}
        >
          {sheet.body}
        </Markdown>
        <p className="border-line text-muted mt-6 border-t pt-2 font-mono text-[10px]">
          Fiche rédigée pour un usage pédagogique ; les valeurs numériques sont celles du modèle
          simulé (voir docs/model.md). À valider par l’équipe Génie Chimique.
        </p>
      </article>
    </aside>
  );
}
