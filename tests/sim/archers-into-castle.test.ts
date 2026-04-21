import { describe, expect, it } from "vitest";
import { exampleScenarioDraft } from "@/lib/fixtures/example-scenario";
import { simulateScenario } from "@/lib/sim";
import { genericRuleset } from "@/lib/sim/rules/generic-ruleset";

describe("starter archer scenario", () => {
  it("produces castle timing answers and monotonic milestones", () => {
    const result = simulateScenario(exampleScenarioDraft, genericRuleset);

    const affordable = result.run.answers.find((answer: (typeof result.run.answers)[number]) => answer.questionId === "q_castle_affordable");
    const clicked = result.run.answers.find((answer: (typeof result.run.answers)[number]) => answer.questionId === "q_castle_clicked");
    const reached = result.run.answers.find((answer: (typeof result.run.answers)[number]) => answer.questionId === "q_castle_reached");
    const archersClick = result.run.answers.find((answer: (typeof result.run.answers)[number]) => answer.questionId === "q_archers_click");
    const archersReach = result.run.answers.find((answer: (typeof result.run.answers)[number]) => answer.questionId === "q_archers_reach");

    expect(typeof affordable?.value).toBe("number");
    expect(typeof clicked?.value).toBe("number");
    expect(typeof reached?.value).toBe("number");

    expect((clicked?.value as number) >= (affordable?.value as number)).toBe(true);
    expect((reached?.value as number) >= (clicked?.value as number)).toBe(true);
    expect(Number(archersReach?.value) >= Number(archersClick?.value)).toBe(true);

    expect(result.resolved.resolvedEvents.some((event: (typeof result.resolved.resolvedEvents)[number]) => event.id.includes("barracks"))).toBe(true);
    expect(result.run.keyframes.length).toBeGreaterThan(10);
    expect(result.run.laneSegments.length).toBeGreaterThan(3);
  });
});
