import { useCallback, useRef, useState } from 'react';
import { regenerateCharacterPose, getBatchStatus } from '@root/image_gen/generated_client';
import type { Brief, LoveInterestCard, OutlinePlan } from './types';
import { useNarrativeStore } from './narrativeStore';
import { IMAGE_SERVER_BASE } from './emotionResolver';

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 300_000;

export type PoseRegenEntry = { liId: string; pose: string };

export type PoseRegenStatus =
  | { state: 'idle' }
  | { state: 'running'; total: number; completed: number; current: string }
  | { state: 'done'; total: number; completed: number; failed: PoseRegenEntry[] };

export type PoseItemStatus = 'generating' | 'done' | 'error';

export function poseKey(liId: string, pose: string) {
  return `${liId}:${pose}`;
}

function buildMasterPrompt(brief: Brief): string {
  const parts: string[] = [];
  if (brief.artStyle.referenceDescriptor) parts.push(brief.artStyle.referenceDescriptor);
  parts.push('full-body character portrait, transparent background');
  if (brief.world.tone.mood) parts.push(`mood: ${brief.world.tone.mood}`);
  return parts.join(', ');
}

function buildCharacterDescription(li: LoveInterestCard): string {
  const lines: string[] = [];
  lines.push(`${li.name}, ${li.age} years old`);
  if (li.roleInWorld) lines.push(`role: ${li.roleInWorld}`);
  const appearanceBits = [
    li.appearance.hair && `hair: ${li.appearance.hair}`,
    li.appearance.build && `build: ${li.appearance.build}`,
    li.appearance.signatureItem && `wears ${li.appearance.signatureItem}`,
    li.appearance.freeform,
  ].filter(Boolean);
  if (appearanceBits.length) lines.push(`appearance: ${appearanceBits.join(', ')}`);
  if (li.personality.traits.length) lines.push(`personality: ${li.personality.traits.join(', ')}`);
  if (li.speechPattern) lines.push(`demeanor: ${li.speechPattern}`);
  return lines.join('\n');
}

function buildStoryContext(brief: Brief, outline: OutlinePlan | null): string {
  const lines: string[] = [];
  if (outline?.title) lines.push(`Story: ${outline.title}`);
  if (outline?.logline) lines.push(`Logline: ${outline.logline}`);
  lines.push(`Setting: ${brief.world.setting.era}, ${brief.world.setting.place}, ${brief.world.setting.specifics}`);
  return lines.join('\n');
}

async function pollUntilDone(batchId: string): Promise<{ file: string } | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const { data } = await getBatchStatus({ path: { batchId } });
    if (!data) continue;
    if (data.done) {
      const completed = data.completed?.[0];
      return completed?.file ? { file: completed.file } : null;
    }
    if (data.failed && data.failed.length > 0) return null;
  }
  return null;
}

export function useRegeneratePoses() {
  const [status, setStatus] = useState<PoseRegenStatus>({ state: 'idle' });
  const [poseStatuses, setPoseStatuses] = useState<Record<string, PoseItemStatus>>({});
  const runningRef = useRef(false);

  const start = useCallback(async (entries: PoseRegenEntry[], brief: Brief, outline: OutlinePlan | null) => {
    if (runningRef.current || entries.length === 0) return;
    runningRef.current = true;

    const failed: PoseRegenEntry[] = [];
    let completed = 0;

    setStatus({ state: 'running', total: entries.length, completed: 0, current: '' });

    setPoseStatuses(prev => {
      const next = { ...prev };
      for (const e of entries) next[poseKey(e.liId, e.pose)] = 'generating';
      return next;
    });

    const masterPrompt = buildMasterPrompt(brief);
    const storyContext = buildStoryContext(brief, outline);

    for (const entry of entries) {
      const pk = poseKey(entry.liId, entry.pose);
      setStatus({ state: 'running', total: entries.length, completed, current: `${entry.liId}: ${entry.pose}` });
      setPoseStatuses(prev => ({ ...prev, [pk]: 'generating' }));

      const li = brief.loveInterests.find(l => l.id === entry.liId);
      const charState = useNarrativeStore.getState().characters[entry.liId];
      if (!li || charState?.status !== 'done' || !charState.idleFilename) {
        failed.push(entry);
        setPoseStatuses(prev => ({ ...prev, [pk]: 'error' }));
        continue;
      }

      const referenceImageUrl = `${IMAGE_SERVER_BASE}/images/${encodeURIComponent(charState.idleFilename)}`;

      try {
        const { data, error } = await regenerateCharacterPose({
          body: {
            masterPrompt,
            storyMasterPrompt: storyContext,
            characterDescription: buildCharacterDescription(li),
            pose: entry.pose,
            referenceImageUrl,
          },
        });

        if (error || !data?.batchId) {
          failed.push(entry);
          setPoseStatuses(prev => ({ ...prev, [pk]: 'error' }));
          continue;
        }

        const result = await pollUntilDone(data.batchId);
        if (result) {
          useNarrativeStore.getState().updateCharacterPose(entry.liId, entry.pose, result.file);
          completed++;
          setPoseStatuses(prev => ({ ...prev, [pk]: 'done' }));
        } else {
          failed.push(entry);
          setPoseStatuses(prev => ({ ...prev, [pk]: 'error' }));
        }
      } catch {
        failed.push(entry);
        setPoseStatuses(prev => ({ ...prev, [pk]: 'error' }));
      }
    }

    setStatus({ state: 'done', total: entries.length, completed, failed });
    runningRef.current = false;
  }, []);

  const reset = useCallback(() => {
    if (!runningRef.current) {
      setStatus({ state: 'idle' });
      setPoseStatuses({});
    }
  }, []);

  return { status, poseStatuses, start, reset };
}
