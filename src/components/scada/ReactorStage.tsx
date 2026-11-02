'use client';

import dynamic from 'next/dynamic';
import { Component, useSyncExternalStore, type ErrorInfo, type ReactNode } from 'react';
import { detectWebGL } from '@/lib/webgl';

function LoadingScreen() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-[#0d1013] font-mono text-sm text-zinc-400"
      role="status"
    >
      Chargement de la scène 3D…
    </div>
  );
}

/** Le Canvas WebGL n'est jamais rendu côté serveur (S7-L03). */
const ReactorScene = dynamic(() => import('@/components/canvas/ReactorScene'), {
  ssr: false,
  loading: LoadingScreen,
});

/** Mode 2D (S7-L05) : la scène est indisponible, les commandes et les courbes restent utilisables. */
function SceneUnavailable({ reason }: { reason: string }) {
  return (
    <div
      role="alert"
      data-testid="scene-unavailable"
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0d1013] p-6 text-center font-mono"
    >
      <p className="text-warn text-base font-semibold">Scène 3D indisponible</p>
      <p className="max-w-sm text-xs text-zinc-400">{reason}</p>
      <p className="max-w-sm text-xs text-zinc-300">
        Mode 2D : les commandes, les mesures, les alarmes et les courbes fonctionnent normalement.
      </p>
    </div>
  );
}

/** Intercepte toute erreur de rendu de la scène (contexte WebGL perdu, shader, asset…). */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ReactorStage] erreur de rendu 3D :', error.message, info.componentStack);
  }
  override render(): ReactNode {
    if (this.state.error) {
      return <SceneUnavailable reason={`Erreur de rendu : ${this.state.error.message}`} />;
    }
    return this.props.children;
  }
}

const noopSubscribe = () => () => {};

export function ReactorStage() {
  // serveur : « unknown » (aucun désaccord d'hydratation) ; client : détection mise en cache
  const support = useSyncExternalStore(
    noopSubscribe,
    () => detectWebGL(),
    () => 'unknown' as const,
  );
  if (support === 'unknown') return <LoadingScreen />;
  if (support === 'unavailable') {
    return (
      <SceneUnavailable reason="WebGL n'est pas disponible dans ce navigateur (ou est désactivé)." />
    );
  }
  return (
    <SceneErrorBoundary>
      <ReactorScene />
    </SceneErrorBoundary>
  );
}
