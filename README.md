# AoE2 Build Lab

A desktop-first web MVP scaffold for modeling Age of Empires II build orders and strategy questions like:

> If I do a 19-vil Dark Age, build a Range at the start of Feudal, keep producing villagers and archers, when can I click Castle Age, and how many archers do I have when I get there?

This repo gives you a **working Next.js scaffold**, a **shared TypeScript simulation contract**, a **minimal generic ruleset**, and a **starter scenario workbench UI**.

## What works now

- Next.js App Router + TypeScript project structure
- Tailwind-based UI shell for the scenario workbench
- Pure TypeScript simulation library under `lib/sim`
- Minimal resolver that merges a template opening and infers a Barracks if needed
- Coarse-but-functional economic simulator for the starter scenario
- KPI cards for Castle affordable / clicked / reached + archer counts
- Timeline view, resource graph, inspector, warning rail
- Local draft persistence in `localStorage`
- Vitest starter test for the core scenario

## What is intentionally rough

- The simulator is a **starter implementation**, not a frame-perfect AoE2 engine
- Editing is structured and form-first, not drag-and-drop
- Persistence is local-only for now
- Prisma schema is included, but not wired into runtime yet
- No auth, replay import, or public sharing yet

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Tests

```bash
npm test
```

## Cloudflare / OpenNext workflow

Local Node development:

```bash
npm run dev
```

Preview inside the Workers runtime:

```bash
npm run preview
```

Deploy once you have a Cloudflare account and project bindings set up:

```bash
npm run deploy
```

## Project layout

```text
app/
  layout.tsx
  page.tsx
  scenarios/[id]/page.tsx

components/scenario/
  scenario-workbench.tsx
  builder-tabs.tsx
  kpi-bar.tsx
  timeline-viewport.tsx
  resource-graph.tsx
  inspector-panel.tsx
  warnings-rail.tsx

lib/sim/
  schema.ts
  rules/generic-ruleset.ts
  resolver.ts
  engine.ts
  answers.ts
  warnings.ts
```

## Next suggested steps

1. Make the sim more accurate: queue behavior, resource drop-offs, eco techs, depletion, walk time.
2. Wire in persistence with Prisma or a Cloudflare-native datastore.
3. Add compare mode and read-only share links.
4. Replace the fixed event editors with generic event/policy modals.
