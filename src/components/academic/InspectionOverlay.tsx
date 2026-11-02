'use client';

import { useEffect, useMemo, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Readout } from '@/components/ui/Readout';
import { computeGeometry } from '@/simulation/geometry';
import { useReactorStore } from '@/store/useReactorStore';
import { inspectionLabels, type InspectionLabelSpec } from './inspectionSpecs';
import { MAX_LABELS, labelScreen } from './labelProjection';

/** Rendu KaTeX en chaîne HTML : contenu statique de confiance (formules du dépôt), pas d'entrée utilisateur. */
function renderTex(tex: string): string {
  return katex.renderToString(tex, { throwOnError: false, strict: 'ignore', output: 'html' });
}

function LabelCard({
  spec,
  setRef,
}: {
  spec: InspectionLabelSpec;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  const patchUi = useReactorStore((s) => s.patchUi);
  const html = useMemo(() => renderTex(spec.tex), [spec.tex]);
  return (
    <div
      ref={setRef}
      data-testid={`inspect-label-${spec.id}`}
      className="border-accent/60 bg-panel/92 pointer-events-auto absolute top-0 left-0 hidden w-48 rounded border p-2 font-mono shadow-xl backdrop-blur-sm will-change-transform"
    >
      <div className="text-accent text-[10px] font-semibold tracking-wide uppercase">
        {spec.title}
      </div>
      <div
        className="my-1 overflow-x-auto text-[11px] text-zinc-100"
        aria-label={`Formule : ${spec.tex}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div className="border-line flex items-baseline justify-between border-t pt-1">
        <span className="text-sm text-zinc-100 tabular-nums">
          <Readout format={spec.value} />
          <span className="text-muted ml-1 text-[10px]">{spec.unit}</span>
        </span>
        <button
          type="button"
          onClick={() => patchUi({ theorySheet: spec.sheet })}
          className="border-line bg-panel-2 hover:bg-line focus-visible:outline-accent rounded border px-1.5 py-0.5 text-[10px] text-zinc-200 focus-visible:outline focus-visible:outline-2"
        >
          Fiche ▸
        </button>
      </div>
    </div>
  );
}

/**
 * Étiquettes d'inspection (S6-L01) : cartes DOM (formule KaTeX + valeur vivante à 10 Hz) placées
 * sur les ancrages 3D projetés par `LabelProjector`. Positionnement par `transform` dans un rAF :
 * aucun re-rendu React. Pas d'occlusion : un lancer de rayon ignorerait la découpe en coin du
 * shader et masquerait à tort les étiquettes situées dans la cuve ouverte.
 */
export function InspectionOverlay() {
  const active = useReactorStore((s) => s.ui.inspectionMode);
  const volumeL = useReactorStore((s) => s.params.volumeL);
  const specs = useMemo(
    () => inspectionLabels(computeGeometry(volumeL)).slice(0, MAX_LABELS),
    [volumeL],
  );
  const cards = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      for (let i = 0; i < specs.length; i++) {
        const el = cards.current[i];
        if (!el) continue;
        const visible = labelScreen[i * 3 + 2] === 1;
        if (!visible) {
          el.style.display = 'none';
          continue;
        }
        el.style.display = 'block';
        // ancrage au centre de la carte
        el.style.transform = `translate(${(labelScreen[i * 3] as number).toFixed(1)}px, ${(labelScreen[i * 3 + 1] as number).toFixed(1)}px) translate(-50%, -50%)`;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, specs]);

  if (!active) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-label="Étiquettes d’inspection"
      role="group"
    >
      {specs.map((spec, i) => (
        <LabelCard
          key={spec.id}
          spec={spec}
          setRef={(el) => {
            cards.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}
