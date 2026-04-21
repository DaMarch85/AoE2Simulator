import Link from "next/link";
import { exampleScenarioDraft } from "@/lib/fixtures/example-scenario";

export default function NewScenarioPage() {
  return (
    <main className="panel p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-slate-400">New scenario</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-50">Wizard placeholder</h1>
      <p className="mt-4 max-w-2xl text-sm text-slate-300">
        The scaffold keeps creation intentionally simple for now. The next slice is a real wizard
        that lets you choose a base opening, civ, assumptions, and policies before entering the editor.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/scenarios/${exampleScenarioDraft.id}`}
          className="rounded-full border border-violet-400/40 bg-violet-500/20 px-5 py-3 text-sm font-medium text-violet-100"
        >
          Start from the archer scenario
        </Link>
        <Link
          href="/"
          className="rounded-full border border-slate-700/70 bg-slate-900/45 px-5 py-3 text-sm text-slate-100"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
