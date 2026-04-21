import { formatClock } from "@/lib/utils";
import type { SimulationRun } from "@/lib/sim/schema";

function answerValue(run: SimulationRun, questionId: string) {
  return run.answers.find((answer) => answer.questionId === questionId);
}

function stat(label: string, value: string, secondary?: string) {
  return (
    <div className="stat-card">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
      {secondary ? <p className="mt-2 text-sm text-slate-400">{secondary}</p> : null}
    </div>
  );
}

export function KpiBar({ run }: { run: SimulationRun }) {
  const affordable = answerValue(run, "q_castle_affordable")?.value as number | null | undefined;
  const clicked = answerValue(run, "q_castle_clicked")?.value as number | null | undefined;
  const reached = answerValue(run, "q_castle_reached")?.value as number | null | undefined;
  const archersClick = answerValue(run, "q_archers_click")?.displayText ?? "0";
  const archersReach = answerValue(run, "q_archers_reach")?.displayText ?? "0";
  const bottleneck = answerValue(run, "q_bottleneck")?.displayText ?? "—";

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {stat("Castle affordable", formatClock(affordable), "First moment the sim meets cost + prereqs")}
      {stat("Castle clicked", formatClock(clicked), "When the Town Center actually starts Castle Age")}
      {stat("Castle reached", formatClock(reached), "Actual arrival time")}
      {stat("Archers at milestones", `${archersClick} / ${archersReach}`, "Click / reach")}
      {stat("Bottleneck", bottleneck, `${run.warnings.length} warning${run.warnings.length === 1 ? "" : "s"}`)}
    </section>
  );
}
