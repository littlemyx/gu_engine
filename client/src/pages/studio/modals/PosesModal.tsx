import React, { useMemo } from 'react';

import { CANONICAL_POSES } from '@/narrative';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { poseKey } from '@/narrative/useRegeneratePoses';
import ActionButton from '@/ui/ActionButton';
import { pluralize } from '@/ui/plural';

import Modal from './Modal';

import styles from './modals.module.css';

import type { PoseItemStatus, PoseRegenEntry, PoseRegenStatus } from '@/narrative/useRegeneratePoses';
import type { Brief } from '@/narrative/types';

export interface PosesModalProps {
  brief: Brief;
  status: PoseRegenStatus;
  /** Пер-позные статусы прогона: ошибка конкретной позы даёт чип «повторить». */
  poseStatuses: Record<string, PoseItemStatus>;
  disabledReason?: string;
  onStart: (entries: PoseRegenEntry[]) => void;
  onClose: () => void;
}

type PoseChip = { pose: string; state: 'done' | 'missing' | 'error' | 'generating' };

type CharacterRow = {
  liId: string;
  name: string;
  done: number;
  chips: PoseChip[] | null;
  /** Что догенерировать у этого персонажа: недостающее + упавшее. */
  entries: PoseRegenEntry[];
};

/**
 * «Недостающие позы спрайтов» (макет 7d): сценарий требует поз, которых нет в
 * наборе персонажа — эмоции реплик нормализованы к каноническим позам.
 * Полный персонаж сворачивается в строку «все позы на месте».
 */
const PosesModal = ({ brief, status, poseStatuses, disabledReason, onStart, onClose }: PosesModalProps) => {
  const characters = useNarrativeStore(s => s.characters);

  const rows = useMemo((): CharacterRow[] => {
    const out: CharacterRow[] = [];
    for (const li of brief.loveInterests) {
      const state = characters[li.id];
      if (state?.status !== 'done') continue;
      const chips: PoseChip[] = CANONICAL_POSES.map(pose => {
        if (pose === 'idle') return { pose, state: 'done' };
        const item = poseStatuses[poseKey(li.id, pose)];
        if (item === 'generating') return { pose, state: 'generating' };
        if (item === 'error') return { pose, state: 'error' };
        return state.poseFilenames?.[pose] ? { pose, state: 'done' } : { pose, state: 'missing' };
      });
      const entries = chips
        .filter(c => c.state === 'missing' || c.state === 'error')
        .map(c => ({ liId: li.id, pose: c.pose }));
      const done = chips.filter(c => c.state === 'done').length;
      out.push({
        liId: li.id,
        name: li.name || li.id,
        done,
        chips: entries.length > 0 || done < CANONICAL_POSES.length ? chips : null,
        entries,
      });
    }
    return out;
  }, [brief.loveInterests, characters, poseStatuses]);

  const allEntries = rows.flatMap(r => r.entries);
  const running = status.state === 'running';
  const progress = running ? (status.total === 0 ? 0 : status.completed / status.total) : 0;

  return (
    <Modal
      title="Недостающие позы спрайтов"
      subtitle="сценарий требует поз, которых нет в наборе персонажа — эмоции реплик нормализованы к 8 каноническим позам"
      wide
      onClose={onClose}
      footer={
        <>
          <ActionButton onLight kind="outline" label="Отменить" onClick={onClose} />
          <ActionButton
            onLight
            label={`Догенерировать ${pluralize(allEntries.length, 'позу', 'позы', 'поз')}`}
            cost="≈ $0.02 за позу"
            disabled={running || allEntries.length === 0 || Boolean(disabledReason)}
            reason={running ? 'догенерация уже идёт' : allEntries.length === 0 ? 'все позы на месте' : disabledReason}
            onClick={() => onStart(allEntries)}
          />
        </>
      }
    >
      {rows.length === 0 && (
        <p className={styles.note}>Готовых спрайтов ещё нет — позы догенерируются после отрисовки персонажей.</p>
      )}

      {rows.map(row => (
        <div key={row.liId} className={styles.poseBlock}>
          <div className={styles.poseHead}>
            <span className={styles.moodTitle}>{row.name}</span>
            {row.chips == null ? (
              <span className={styles.poseAllOk}>все позы на месте</span>
            ) : (
              <span className={styles.mono}>
                {row.done}/{CANONICAL_POSES.length} поз
              </span>
            )}
          </div>
          {row.chips != null && (
            <div className={styles.poseChips}>
              {row.chips.map(chip => {
                const retriable = chip.state === 'error' && !running;
                return (
                  <button
                    key={chip.pose}
                    type="button"
                    className={`${styles.poseChip} ${
                      chip.state === 'missing'
                        ? styles.poseChipMissing
                        : chip.state === 'error'
                        ? styles.poseChipError
                        : chip.state === 'generating'
                        ? styles.poseChipWait
                        : ''
                    }`}
                    disabled={!retriable}
                    title={retriable ? 'повторить только эту позу' : undefined}
                    onClick={retriable ? () => onStart([{ liId: row.liId, pose: chip.pose }]) : undefined}
                  >
                    {chip.pose}
                    {chip.state === 'done' && ' ✓'}
                    {chip.state === 'missing' && ' — нет'}
                    {chip.state === 'generating' && ' ⟳'}
                    {chip.state === 'error' && ' ✗ · повторить'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {running && (
        <div className={styles.poseProgress}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className={styles.poseProgressMeta}>
            <span>
              догенерация: {status.completed} из {status.total}
              {status.current ? ` · ${status.current}` : ''}
            </span>
            <span className={styles.mono}>≈ $0.02 за позу</span>
          </div>
        </div>
      )}

      {status.state === 'done' && status.failed.length > 0 && (
        <p className={`${styles.note} ${styles.poseFailNote}`}>
          ✗ не удалось: {status.failed.map(f => `${f.liId}:${f.pose}`).join(', ')} — чипы с ошибкой можно повторить
          точечно
        </p>
      )}
    </Modal>
  );
};

export default PosesModal;
