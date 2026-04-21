import Link from "next/link";
import { listScenarioFixtures } from "@/lib/scenarios/catalog";

export default function HomePage() {
  const scenarios = listScenarioFixtures();

  return (
    <main className="space-y-8">
      <section className="panel p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-400">AoE2 Build Lab</p>
        <h1 className="mt-3 text-4xl font-semibold text-slate-50">Build-order modeling MVP scaffold</h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300">
          Start from a scenario, tweak the assumptions, run the sim, and inspect the timeline.
          This scaffold is wired for a pure TypeScript sim core and a Next.js workbench UI.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-violet-400/40 bg-violet-500/20 px-5 py-3 text-sm font-medium text-violet-100"
            href={`/scenarios/${scenarios[0]?.id ?? "demo"}`}
          >
            Open starter scenario
          </Link>
          <Link
            className="rounded-full border border-slate-700/70 bg-slate-900/45 px-5 py-3 text-sm text-slate-200"
            href="/scenarios/new"
          >
            New scenario
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {scenarios.map((scenario) => (
          <article key={scenario.id} className="panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Scenario</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-50">{scenario.name}</h2>
                <p className="mt-3 text-sm text-slate-300">{scenario.prompt}</p>
              </div>
              <span className="badge">Starter</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="badge">Civ: {scenario.civId}</span>
              <span className="badge">Template: {scenario.baseOpeningId}</span>
              <span className="badge">Questions: {scenario.questions.length}</span>
            </div>

            <div className="mt-6">
              <Link
                href={`/scenarios/${scenario.id}`}
                className="rounded-full border border-slate-700/70 bg-slate-900/45 px-4 py-2 text-sm text-slate-100"
              >
                Open workbench
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
