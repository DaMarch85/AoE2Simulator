import type { Ruleset } from '@/lib/sim/schema';

const rows = [
  { label: 'Sheep', key: 'sheep' },
  { label: 'Boar', key: 'boar' },
  { label: 'Berries', key: 'berries' },
  { label: 'Deer', key: 'deer' },
  { label: 'Farms', key: 'farms' },
  { label: 'Wood', key: 'wood' },
  { label: 'Gold', key: 'gold' },
  { label: 'Stone', key: 'stone' },
] as const;

export function CollectionRatePanel({ ruleset }: { ruleset: Ruleset }) {
  return (
    <section className="panel-subtle p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Collection rate reference</h3>
        <p className="text-xs text-slate-400">Generic ruleset gather rates shown per villager per minute.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden border border-slate-700/70 bg-slate-950/40">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-700/70 bg-slate-900/50 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium">Per second</th>
                <th className="px-3 py-2 text-right font-medium">Per minute</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const perSecond = ruleset.gatherRates[row.key];
                return (
                  <tr key={row.key} className="border-b border-slate-800/70 text-slate-200 last:border-0">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{perSecond.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium">{(perSecond * 60).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border border-slate-700/70 bg-slate-950/40 p-3 text-sm text-slate-300">
          <h4 className="text-sm font-semibold text-slate-100">Farm economics</h4>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span>Wood cost</span>
              <span className="font-medium text-slate-100">{ruleset.startingFoodSources.farmWoodCost}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Build time</span>
              <span className="font-medium text-slate-100">{ruleset.startingFoodSources.farmBuildTimeSec}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Food per farm</span>
              <span className="font-medium text-slate-100">{ruleset.startingFoodSources.farmFood}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
