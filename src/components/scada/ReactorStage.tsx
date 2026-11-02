'use client';

import dynamic from 'next/dynamic';

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

export function ReactorStage() {
  return <ReactorScene />;
}
