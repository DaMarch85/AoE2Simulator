import type {
  Age,
  Answer,
  ResolvedScenario,
  Ruleset,
  SimulationRun,
} from "./schema";
import { AnswerSchema } from "./schema";
import { ageLabel } from "./helpers";
import { formatClock } from "@/lib/utils";

export interface SimulationMilestones {
  ageAffordableAt: Partial<Record<Age, number>>;
  ageClickedAt: Partial<Record<Age, number>>;
  ageReachedAt: Partial<Record<Age, number>>;
  unitCountsAtMilestone: Record<string, number>;
  bottleneckLabel: string | null;
}

function unitMilestoneKey(unitId: string, milestone: string, age: Age) {
  return `${unitId}:${milestone}:${age}`;
}

export function buildAnswers(
  run: SimulationRun,
  scenario: ResolvedScenario,
  _ruleset: Ruleset,
  milestones: SimulationMilestones,
): Answer[] {
  const answers: Answer[] = [];

  for (const question of scenario.questions) {
    let answer: Answer | null = null;

    switch (question.kind) {
      case "age_affordable_at": {
        const value = milestones.ageAffordableAt[question.age] ?? null;
        answer = {
          questionId: question.id,
          value,
          displayText: value == null ? `${ageLabel(question.age)} not affordable` : formatClock(value),
        };
        break;
      }

      case "age_clicked_at": {
        const value = milestones.ageClickedAt[question.age] ?? null;
        answer = {
          questionId: question.id,
          value,
          displayText: value == null ? `${ageLabel(question.age)} not clicked` : formatClock(value),
        };
        break;
      }

      case "age_reached_at": {
        const value = milestones.ageReachedAt[question.age] ?? null;
        answer = {
          questionId: question.id,
          value,
          displayText: value == null ? `${ageLabel(question.age)} not reached` : formatClock(value),
        };
        break;
      }

      case "unit_count_at_milestone": {
        const key = unitMilestoneKey(question.unitId, question.milestone, question.age);
        const value = milestones.unitCountsAtMilestone[key] ?? 0;
        answer = {
          questionId: question.id,
          value,
          displayText: `${value}`,
        };
        break;
      }

      case "resource_at_time": {
        const keyframe =
          run.keyframes.find((frame: SimulationRun["keyframes"][number]) => frame.timeSec >= question.timeSec) ??
          run.keyframes[run.keyframes.length - 1];

        const value = keyframe?.stockpile[question.resource] ?? null;
        answer = {
          questionId: question.id,
          value,
          displayText: value == null ? "—" : `${Math.round(value)}`,
        };
        break;
      }

      case "bottleneck_summary": {
        answer = {
          questionId: question.id,
          value: milestones.bottleneckLabel,
          displayText: milestones.bottleneckLabel ?? "No obvious bottleneck",
        };
        break;
      }
    }

    if (answer) {
      answers.push(AnswerSchema.parse(answer));
    }
  }

  return answers;
}
