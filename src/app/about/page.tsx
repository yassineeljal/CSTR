import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'À propos — CSTR Digital Twin',
  description:
    "Équipe, architecture, modèle et crédits du jumeau numérique 3D d'un réacteur agité continu exothermique.",
};

const REPO = 'https://github.com/yassineeljal/CSTR';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-muted font-mono text-xs font-semibold tracking-widest uppercase">
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Link
        href="/"
        className="text-accent focus-visible:outline-accent font-mono text-xs underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2"
      >
        ← Retour au simulateur
      </Link>
      <h1 className="mt-4 font-mono text-2xl font-semibold tracking-tight text-zinc-100">
        CSTR Digital Twin
      </h1>
      <p className="mt-2 text-zinc-300">
        Jumeau numérique d’un réacteur chimique agité continu (CSTR) exothermique, simulé à 60 Hz
        dans le navigateur, rendu en 3D temps réel et piloté depuis un poste de contrôle de style
        SCADA.
      </p>

      <Section title="Projet">
        <p>
          Projet conjoint <strong className="text-zinc-100">Génie Chimique</strong> (Polytechnique
          Montréal) et <strong className="text-zinc-100">Génie Logiciel / 3D</strong> (ÉTS). Outil
          pédagogique sur la stabilité, la multiplicité d’états stationnaires et la régulation ;
          vitrine technique de la 3D temps réel, des shaders et d’une architecture multi-thread.
        </p>
      </Section>

      <Section title="Architecture">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-zinc-100">Moteur physique</strong> : intégrateur RK4 à pas fixe
            (0,01 s), PID échantillonné (0,1 s), soupape à hystérésis, dans un <em>Web Worker</em>{' '}
            dédié. Module pur TypeScript, testé sous Node.
          </li>
          <li>
            <strong className="text-zinc-100">Communication</strong> : <code>postMessage</code> d’un{' '}
            <code>Float64Array</code> transférable à ≈ 60 Hz ; aucune donnée rapide dans l’état
            React.
          </li>
          <li>
            <strong className="text-zinc-100">3D</strong> : React Three Fiber ; cuve, enveloppe et
            agitateur procéduraux (coupe animée par shader), pièces détaillées modélisées sous
            Blender (<code>.glb</code> Draco), shaders GLSL pour le fluide, bulles et vapeur sur
            GPU.
          </li>
          <li>
            <strong className="text-zinc-100">Validation</strong> : le moteur TypeScript reproduit
            des trajectoires SciPy (écart relatif &lt; 3·10⁻⁸) ; notebooks Jupyter pour les états
            stationnaires, Van Heerden, l’accord du PID et les scénarios.
          </li>
        </ul>
      </Section>

      <Section title="Modèle">
        <p>
          Réaction irréversible d’ordre 1 <em>A → B</em>, bilans de matière et d’énergie, double
          enveloppe avec vanne, pression de vapeur (Antoine) et soupape. Deux jeux de paramètres :
          le benchmark de Seborg et l’hydrolyse de l’oxyde de propylène (cinétique de Fogler). Les
          écarts par rapport au plan initial sont justifiés dans{' '}
          <a className="text-accent underline" href={`${REPO}/blob/main/docs/model.md`}>
            docs/model.md
          </a>
          .
        </p>
        <p className="text-muted">
          Limites : pression de l’eau pure, volume constant, mélange parfait, soupape volontairement
          sous-dimensionnée. Les valeurs marquées « à valider » n’ont pas été revues par l’équipe
          Génie Chimique.
        </p>
      </Section>

      <Section title="Code et crédits">
        <p>
          Code source :{' '}
          <a className="text-accent underline" href={REPO}>
            {REPO}
          </a>
          .
        </p>
        <ul className="text-muted list-disc space-y-1 pl-5">
          <li>
            S. Seborg, T. Edgar, D. Mellichamp, F. Doyle — <em>Process Dynamics and Control</em>{' '}
            (benchmark CSTR).
          </li>
          <li>
            H. S. Fogler — <em>Elements of Chemical Reaction Engineering</em> (cinétique de l’oxyde
            de propylène).
          </li>
          <li>
            E. Paul, V. Atiemo-Obeng, S. Kresta — <em>Handbook of Industrial Mixing</em>{' '}
            (proportions de cuve agitée).
          </li>
          <li>Three.js, React Three Fiber, uPlot, KaTeX, Zustand, Next.js.</li>
        </ul>
      </Section>
    </main>
  );
}
