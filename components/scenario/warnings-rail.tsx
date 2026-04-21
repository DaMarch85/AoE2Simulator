import type { SimulationRun, Warning } from "@/lib/sim/schema";

export function WarningsRail({ run }: { run: SimulationRun }) {
  return (
    <section className="panel-subtle p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Warnings</h3>
        <p className="text-xs text-slate-400">Explanation-first messages to keep the output readable.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {run.warnings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700/70 px-4 py-5 text-sm text-slate-400">
            No warnings in the current run.
          </div>
        ) : (
          run.warnings.map((warning: Warning) => (
            <div
              key={warning.code}
              className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-4"
            >
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{warning.severity}</p>
              <p className="mt-2 text-sm font-medium text-slate-100">{warning.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
