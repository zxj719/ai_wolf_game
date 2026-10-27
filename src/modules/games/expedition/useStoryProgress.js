import { useEffect, useState } from "react";
import { createStoryProgress, finishStory, restoreStoryProgress, storyStorageKey, syncStoryProgress } from "./storyProgress";

export default function useStoryProgress(campaign) {
  const [progress, setProgress] = useState(() => {
    try { return restoreStoryProgress(localStorage.getItem(storyStorageKey(campaign.seed)), campaign); }
    catch { return createStoryProgress(campaign); }
  });
  useEffect(() => { setProgress((p) => syncStoryProgress(p, campaign)); }, [campaign]);
  useEffect(() => {
    try { localStorage.setItem(storyStorageKey(progress.seed), JSON.stringify(progress)); }
    catch { /* The campaign save notice handles unavailable browser storage. */ }
  }, [progress]);
  return {
    ...progress,
    setLine: (line) => setProgress((p) => ({ ...p, positions: { ...p.positions, [p.active]: line } })),
    finish: () => setProgress(finishStory),
    suspend: () => setProgress((p) => ({ ...p, active: null })),
    resume: (id) => setProgress((p) => ({ ...p, active: id || p.queue[0] || (campaign.journey ? "firstSteps" : "opening") })),
    completeLesson: () => setProgress((p) => ({ ...p, lessonDone: true })),
    setLessonActive: (active) => setProgress((p) => ({ ...p, lessonActive: active })),
  };
}
