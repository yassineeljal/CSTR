'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { SRGBColorSpace } from 'three';
import { useQuality } from '@/hooks/useQuality';
import { scaledCount } from '@/lib/quality';
import { computeGeometry } from '@/simulation/geometry';
import { useReactorStore } from '@/store/useReactorStore';
import { Agitator } from './Agitator';
import { BubbleParticles, MAX_BUBBLES } from './BubbleParticles';
import { Baffles } from './Baffles';
import { CoolingJacket } from './CoolingJacket';
import { CutawayProvider } from './CutawayContext';
import { LabelProjector } from '@/components/academic/LabelProjector';
import { Fluid } from './Fluid';
import { PostEffects } from './PostEffects';
import { ReactorDetails } from './ReactorDetails';
import { ReactorVessel } from './ReactorVessel';
import { RenderStats } from './RenderStats';
import { MAX_STEAM, SteamParticles } from './SteamParticles';
import { FrameDriver } from './FrameDriver';
import { AdaptiveQuality } from './AdaptiveQuality';
import { VibrationRig } from './VibrationRig';

/** Réglages live : uniquement en développement, absents du bundle de production (S3-L09). */
const DevControls =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('./DevControls'), { ssr: false })
    : () => null;

/** Studio procédural : 3 panneaux lumineux (aucun HDRI téléchargé → fonctionne hors ligne). */
/** Drapeau de diagnostic (URL) : `?fx=off` coupe le post-traitement (mesure du coût des effets). */
function diagnosticFlag(name: string): boolean {
  return (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(name) === 'off'
  );
}

function StudioEnvironment() {
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={['#202833']} />
      {/* voûte douce : donne du corps aux métaux (sans elle l'acier reflète le noir) */}
      <Lightformer
        form="circle"
        intensity={0.9}
        color="#9fb4cc"
        position={[0, 12, 0]}
        rotation-x={Math.PI / 2}
        scale={26}
      />
      <Lightformer
        form="rect"
        intensity={3.2}
        color="#e3ecff"
        position={[-5, 4, 4]}
        scale={[7, 3.5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#ffe9d1"
        position={[6, 3, -3]}
        scale={[6, 3, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.4}
        color="#c9dcff"
        position={[0, 3, -8]}
        scale={[12, 4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.6}
        color="#ffffff"
        position={[0, 2, 8]}
        scale={[10, 3, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.0}
        color="#8fa6c4"
        position={[-8, 2, -2]}
        rotation-y={Math.PI / 2}
        scale={[8, 3, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.0}
        color="#8fa6c4"
        position={[8, 2, 2]}
        rotation-y={-Math.PI / 2}
        scale={[8, 3, 1]}
      />
    </Environment>
  );
}

function Reactor() {
  const volumeL = useReactorStore((s) => s.params.volumeL);
  const fcMaxLps = useReactorStore((s) => s.params.fcMaxLps);
  const { tier } = useQuality();
  const g = useMemo(() => computeGeometry(volumeL), [volumeL]);
  return (
    <CutawayProvider>
      <VibrationRig>
        <ReactorVessel geometry={g} />
        <CoolingJacket geometry={g} fcMaxLps={fcMaxLps} />
        <Baffles geometry={g} />
        <Fluid geometry={g} />
        <BubbleParticles geometry={g} count={scaledCount(MAX_BUBBLES, tier)} />
        <Agitator geometry={g} />
        <SteamParticles geometry={g} count={scaledCount(MAX_STEAM, tier)} />
        <Suspense fallback={null}>
          <ReactorDetails geometry={g} />
        </Suspense>
      </VibrationRig>
      <LabelProjector />
      <group>
        <Floor y={g.floorY} radius={g.tankDiameter * 6} />
      </group>
    </CutawayProvider>
  );
}

function Floor({ y, radius }: { y: number; radius: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[radius, 96]} />
        <meshStandardMaterial color="#1b2026" metalness={0.2} roughness={0.85} />
      </mesh>
      {/* frames={1} : ombre de contact calculée une fois (le réacteur est statique) ; sinon elle
          re-rend toute la scène depuis le sol à chaque image */}
      <ContactShadows
        frames={1}
        position={[0, 0.002, 0]}
        opacity={0.55}
        scale={radius * 1.2}
        blur={2.4}
        far={1.6}
        resolution={1024}
      />
    </group>
  );
}

/** Scène 3D complète (client uniquement). */
export default function ReactorScene() {
  const volumeL = useReactorStore((s) => s.params.volumeL);
  const g = useMemo(() => computeGeometry(volumeL), [volumeL]);
  const target = useMemo<[number, number, number]>(
    () => [0, g.shellHeight * 0.45, 0],
    [g.shellHeight],
  );
  const dist = g.tankDiameter * 3.4;

  // Les erreurs WebGL asynchrones sont gérées par l'ErrorBoundary de la page (S7-L05)
  useEffect(() => {
    document.documentElement.dataset.scene = 'ready';
    return () => {
      delete document.documentElement.dataset.scene;
    };
  }, []);

  return (
    <Canvas
      shadows
      flat
      frameloop="demand"
      gl={{
        antialias: false,
        outputColorSpace: SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      camera={{ position: [dist * 0.85, g.shellHeight * 0.75, dist], fov: 38, near: 0.05, far: 60 }}
      data-testid="reactor-canvas"
    >
      <color attach="background" args={['#0d1013']} />
      <fog attach="fog" args={['#0d1013', 6, 18]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[3, 5, 2.5]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={2}
        shadow-camera-bottom={-1.5}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-3, 2, -3]} intensity={0.6} color="#7aa7ff" />
      <StudioEnvironment />
      <Reactor />
      {!diagnosticFlag('fx') && <PostEffects />}
      <FrameDriver />
      <AdaptiveQuality />
      <RenderStats />
      <DevControls />
      <OrbitControls
        makeDefault
        target={target}
        enableDamping
        dampingFactor={0.08}
        minDistance={g.tankDiameter * 1.4}
        maxDistance={g.tankDiameter * 8}
        maxPolarAngle={Math.PI / 2 - 0.03}
        enablePan
        panSpeed={0.6}
      />
    </Canvas>
  );
}
