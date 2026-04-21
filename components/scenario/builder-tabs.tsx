"use client";

import type { Policy, ResolvedScenario, ScenarioDraft } from "@/lib/sim/schema";

type TabId = "setup" | "events" | "policies" | "questions" | "json";

function sectionTitle(title: string, subtitle: string) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

export function BuilderTabs({
  draft,
  resolved,
  activeTab,
  onTabChange,
  onDraftChange,
}: {
  draft: ScenarioDraft;
  resolved: ResolvedScenario;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onDraftChange: (draft: ScenarioDraft) => void;
}) {
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "setup", label: "Setup" },
    { id: "events", label: "Events" },
    { id: "policies", label: "Policies" },
    { id: "questions", label: "Questions" },
    { id: "json", label: "JSON" },
  ];


  const feudalEvent = draft.userEvents.find((event) => event.id === "evt_feudal_19_vils");
  const rangeEvent = draft.userEvents.find((event) => event.id === "evt_range_on_feudal");
  const blacksmithEvent = draft.userEvents.find((event) => event.id === "evt_blacksmith_after_range");

  return (
    <section className="panel p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            className={
              activeTab === tab.id
                ? "rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-2 text-sm font-medium text-violet-100"
                : "rounded-full border border-slate-700/70 bg-slate-900/45 px-3 py-2 text-sm text-slate-300"
            }
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "setup" ? (
        <div>
          {sectionTitle("Scenario setup", "Core assumptions and the current starter template.")}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Scenario name</span>
              <input
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-sm"
                value={draft.name}
                onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Civilization</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-sm"
                  value={draft.civId}
                  onChange={(event) => onDraftChange({ ...draft, civId: event.target.value })}
                >
                  <option value="generic">Generic</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Execution profile</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-sm"
                  value={draft.assumptions.executionProfile}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      assumptions: {
                        ...draft.assumptions,
                        executionProfile: event.target.value as ScenarioDraft["assumptions"]["executionProfile"],
                      },
                    })
                  }
                >
                  <option value="perfect">Perfect</option>
                  <option value="clean">Clean</option>
                  <option value="ladder">Ladder</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Deer pushed</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-sm"
                  value={draft.assumptions.deerPushed}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      assumptions: {
                        ...draft.assumptions,
                        deerPushed: Number(event.target.value) as 0 | 1 | 2 | 3,
                      },
                    })
                  }
                >
                  {[0, 1, 2, 3].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Auto house buffer</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-sm"
                  value={draft.assumptions.autoDefaults.autoHouseBuffer}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      assumptions: {
                        ...draft.assumptions,
                        autoDefaults: {
                          ...draft.assumptions.autoDefaults,
                          autoHouseBuffer: Number(event.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "events" ? (
        <div>
          {sectionTitle("Editable user events", "The scaffold keeps this form-focused rather than drag-and-drop.")}
          <div className="space-y-4">
            {feudalEvent ? (
              <label className="block rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
                <span className="block text-sm font-medium text-slate-200">{feudalEvent.label}</span>
                <span className="mt-1 block text-xs text-slate-400">Trigger at villager count</span>
                <input
                  type="number"
                  min={15}
                  max={25}
                  className="mt-3 w-full rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm"
                  value={feudalEvent.trigger.type === "at_villager_count" ? feudalEvent.trigger.villagers : 19}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      userEvents: draft.userEvents.map((item) =>
                        item.id === feudalEvent.id
                          ? {
                              ...item,
                              trigger: {
                                type: "at_villager_count",
                                villagers: Number(event.target.value),
                              },
                            }
                          : item,
                      ),
                    })
                  }
                />
              </label>
            ) : null}

            {rangeEvent ? (
              <label className="block rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
                <span className="block text-sm font-medium text-slate-200">{rangeEvent.label}</span>
                <span className="mt-1 block text-xs text-slate-400">Builders assigned on Feudal hit</span>
                <input
                  type="number"
                  min={1}
                  max={4}
                  className="mt-3 w-full rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm"
                  value={rangeEvent.actions[0]?.type === "build" ? rangeEvent.actions[0].builders : 2}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      userEvents: draft.userEvents.map((item) =>
                        item.id === rangeEvent.id
                          ? {
                              ...item,
                              actions: item.actions.map((action) =>
                                action.type === "build"
                                  ? { ...action, builders: Number(event.target.value) }
                                  : action,
                              ),
                            }
                          : item,
                      ),
                    })
                  }
                />
              </label>
            ) : null}

            {blacksmithEvent ? (
              <label className="block rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
                <span className="block text-sm font-medium text-slate-200">{blacksmithEvent.label}</span>
                <span className="mt-1 block text-xs text-slate-400">Builders assigned after Range completion</span>
                <input
                  type="number"
                  min={1}
                  max={4}
                  className="mt-3 w-full rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm"
                  value={blacksmithEvent.actions[0]?.type === "build" ? blacksmithEvent.actions[0].builders : 2}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      userEvents: draft.userEvents.map((item) =>
                        item.id === blacksmithEvent.id
                          ? {
                              ...item,
                              actions: item.actions.map((action) =>
                                action.type === "build"
                                  ? { ...action, builders: Number(event.target.value) }
                                  : action,
                              ),
                            }
                          : item,
                      ),
                    })
                  }
                />
              </label>
            ) : null}

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
              <h4 className="text-sm font-medium text-slate-200">Resolved event list</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {resolved.resolvedEvents.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-900/45 px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-100">{event.label}</p>
                      <p className="mt-1 text-xs text-slate-400">{event.source}</p>
                    </div>
                    <span className="badge">{event.lane}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "policies" ? (
        <div>
          {sectionTitle("Continuous policies", "The right layer for ‘keep producing’ style questions.")}
          <div className="space-y-4">
            {draft.policies.map((policy) => (
              <div key={policy.id} className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{policy.kind.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-slate-400">Enabled, editable priority, scaffold-level controls.</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={policy.enabled}
                      onChange={(event) =>
                        onDraftChange({
                          ...draft,
                          policies: draft.policies.map((item) =>
                            item.id === policy.id ? { ...item, enabled: event.target.checked } : item,
                          ),
                        })
                      }
                    />
                    enabled
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Priority</span>
                    <select
                      className="w-full rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm"
                      value={policy.priority}
                      onChange={(event) =>
                        onDraftChange({
                          ...draft,
                          policies: draft.policies.map((item) =>
                            item.id === policy.id
                              ? { ...item, priority: event.target.value as Policy["priority"] }
                              : item,
                          ),
                        })
                      }
                    >
                      <option value="must">must</option>
                      <option value="high">high</option>
                      <option value="normal">normal</option>
                      <option value="low">low</option>
                    </select>
                  </label>

                  {"reserveMode" in policy ? (
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Reserve mode</span>
                      <select
                        className="w-full rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm"
                        value={policy.reserveMode}
                        onChange={(event) =>
                          onDraftChange({
                            ...draft,
                            policies: draft.policies.map((item) =>
                              item.id === policy.id && item.kind === "click_age_asap"
                                ? { ...item, reserveMode: event.target.value as typeof item.reserveMode }
                                : item,
                            ),
                          })
                        }
                      >
                        <option value="observe">observe</option>
                        <option value="dynamic">dynamic</option>
                        <option value="hard">hard</option>
                      </select>
                    </label>
                  ) : null}

                  {"popBuffer" in policy ? (
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Pop buffer</span>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        className="w-full rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm"
                        value={policy.popBuffer}
                        onChange={(event) =>
                          onDraftChange({
                            ...draft,
                            policies: draft.policies.map((item) =>
                              item.id === policy.id && item.kind === "auto_house"
                                ? { ...item, popBuffer: Number(event.target.value) }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                  ) : null}

                  {"builders" in policy ? (
                    <label className="block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Builders</span>
                      <input
                        type="number"
                        min={1}
                        max={3}
                        className="w-full rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm"
                        value={policy.builders}
                        onChange={(event) =>
                          onDraftChange({
                            ...draft,
                            policies: draft.policies.map((item) =>
                              item.id === policy.id && item.kind === "auto_house"
                                ? { ...item, builders: Number(event.target.value) }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "questions" ? (
        <div>
          {sectionTitle("Questions and answer cards", "These drive the KPI cards on the main screen.")}
          <div className="space-y-2">
            {draft.questions.map((question) => (
              <div key={question.id} className="rounded-2xl border border-slate-700/70 bg-slate-950/45 px-3 py-3 text-sm text-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <span>{question.kind.replaceAll("_", " ")}</span>
                  <span className="badge">{question.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "json" ? (
        <div>
          {sectionTitle("Raw draft JSON", "Useful while the generic editors are still being built.")}
          <pre className="max-h-[560px] overflow-auto rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 text-xs text-slate-300">
            {JSON.stringify(draft, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
