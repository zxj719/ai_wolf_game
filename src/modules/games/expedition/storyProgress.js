import { STORY_SCENES } from "./storyScript";

export const storyStorageKey = (seed) => `echoes-narrative-v1-${seed}`;

export function availableStories(campaign) {
  if (campaign.journey) return [];
  const worlds = Object.values(campaign.regions);
  const events = campaign.events || [];
  const count = campaign.completed.length;
  const ids = [];
  if (worlds.some((w) => Object.values(w.nodes).some((n) => n.role === "cen"))) ids.push("reunion");
  if (worlds.some((w) => w.journal.some((e) => e.id === "first-camp"))) ids.push("firstCamp");
  if (count >= 1) ids.push("firstClear");
  if (events.some((e) => e.kind === "invasion")) ids.push("invasion");
  if (events.some((e) => e.kind === "reclaimed")) ids.push("reclaimed");
  if (campaign.depth > 1) ids.push("descent");
  return ids;
}

export function createStoryProgress(campaign) {
  // An existing campaign gets the prologue, not a pile of retroactive interruptions.
  const opening = campaign.journey ? "firstSteps" : "opening";
  return {
    version: 1, seed: campaign.seed,
    unlocked: [opening, ...availableStories(campaign)],
    finished: [], queue: [opening], active: opening, positions: {},
    lessonDone: false, lessonActive: false,
  };
}

export function restoreStoryProgress(raw, campaign) {
  try {
    const p = JSON.parse(raw);
    if (p?.version !== 1 || p.seed !== campaign.seed ||
      !Array.isArray(p.unlocked) || !Array.isArray(p.finished) || !Array.isArray(p.queue))
      return createStoryProgress(campaign);
    const known = (xs) => [...new Set(xs.filter((id) => STORY_SCENES[id]))];
    const unlocked = known([campaign.journey ? "firstSteps" : "opening", ...p.unlocked]);
    return {
      version: 1, seed: campaign.seed, unlocked,
      finished: known(p.finished).filter((id) => unlocked.includes(id)),
      queue: known(p.queue).filter((id) => unlocked.includes(id)),
      active: unlocked.includes(p.active) ? p.active : null,
      positions: Object.fromEntries(unlocked.map((id) => [id,
        Math.max(0, Math.min(STORY_SCENES[id].lines.length - 1,
          Number.isSafeInteger(p.positions?.[id]) ? p.positions[id] : 0)),
      ])),
      lessonDone: p.lessonDone === true,
      lessonActive: p.lessonActive === true,
    };
  } catch { return createStoryProgress(campaign); }
}

export function syncStoryProgress(progress, campaign) {
  if (progress.seed !== campaign.seed) return createStoryProgress(campaign);
  const incoming = availableStories(campaign).filter((id) => !progress.unlocked.includes(id));
  if (!incoming.length) return progress;
  return { ...progress, unlocked: [...progress.unlocked, ...incoming],
    queue: [...progress.queue, ...incoming], active: progress.active || incoming[0] };
}

export function finishStory(progress) {
  const id = progress.active;
  const queue = progress.queue.filter((item) => item !== id);
  return { ...progress, active: queue[0] || null, queue,
    finished: [...new Set([...progress.finished, id])].filter(Boolean),
    positions: { ...progress.positions, [id]: 0 } };
}
