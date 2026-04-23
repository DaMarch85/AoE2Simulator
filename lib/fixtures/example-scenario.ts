import type { ScenarioDraft } from '@/lib/sim/schema';
import { createDefaultBuildOrder, createDefaultScenarioDraft, ScenarioDraftSchema } from '@/lib/sim/schema';

export const exampleScenarioDraft: ScenarioDraft = ScenarioDraftSchema.parse(
  createDefaultScenarioDraft({
    id: 'scn_build_order_editor',
    name: 'Build-order editor',
    prompt: 'Create your own build order in the left panel, then run the simulation to populate the dashboard.',
    civId: 'generic',
    rulesetVersion: 'current',
    baseOpeningId: undefined,
    buildOrder: {
      ...createDefaultBuildOrder(3),
      startingVillagers: [
        { id: 'start_vil_1', villagerId: 1, steps: ['sheep', 'hunt', 'wood'] },
        { id: 'start_vil_2', villagerId: 2, steps: ['sheep', 'hunt', 'wood'] },
        { id: 'start_vil_3', villagerId: 3, steps: ['sheep', 'hunt', 'wood'] },
      ],
    },
    userEvents: [],
    policies: [],
  }),
);
