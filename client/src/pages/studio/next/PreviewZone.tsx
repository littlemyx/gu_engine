import React, { useMemo, useState } from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import EmptyState from '@/ui/kit/molecules/EmptyState';
import FlagsSeed from '@/ui/kit/molecules/FlagsSeed';
import GameViewport from '@/ui/kit/molecules/GameViewport';
import PreviewControls from '@/ui/kit/molecules/PreviewControls';
import StrictModeToggle from '@/ui/kit/molecules/StrictModeToggle';

import { useStudioProjectStore } from '../studioProjectStore';

import styles from './shell.module.css';
import preview from './PreviewZone.module.css';

import type { FlagsSeedFlag } from '@/ui/kit/molecules/FlagsSeed';

/**
 * Зона 4 «Превью».
 *
 * Движок ещё не вшит в студию, и экран не притворяется обратного: честная
 * заглушка объясняет, что играть тут будут прямо в редакторе на том же
 * движке, что и релиз, — без отдельного плеера и рассинхрона логики. Экран
 * ничего не запускает — ни один контрол здесь не ведёт к прогону, только
 * показывает, с какими параметрами пойдёт будущий запуск (seed, ветки) и
 * даёт заранее выставить единственную реально переключаемую ручку —
 * строгий режим.
 */
const PreviewZone = () => {
  const seed = useBriefStore(s => s.brief.seed);
  const branchAssignment = useStudioProjectStore(s => s.branchAssignment);

  // Строгий режим — решение автора о будущем запуске, а не о нынешнем
  // состоянии проекта: хранить его в проектном сторе преждевременно, пока
  // сам запуск невозможен. Останется локальным состоянием экрана, пока не
  // появится, что́ ему на самом деле передавать.
  const [strict, setStrict] = useState(false);

  const branchFlags = useMemo<FlagsSeedFlag[]>(
    () =>
      Object.entries(branchAssignment).map(([branchPointId, outcomeId]) => ({
        id: `${branchPointId} → ${outcomeId}`,
        active: true,
      })),
    [branchAssignment],
  );

  const branchSummary =
    branchFlags.length > 0 ? `назначено вручную: ${branchFlags.length}` : 'развилки не назначены — по умолчанию';

  const seedLabel = seed != null ? `seed ${seed} · фиксирован` : 'seed — · новый на каждой генерации';

  return (
    <div className={styles.zoneBody}>
      <h1 className={styles.zoneHeading}>Превью</h1>
      <p className={styles.zoneHint}>играть прямо в редакторе, на том же движке, что и релиз</p>

      <div className={styles.section}>
        <EmptyState
          title="Движок ещё не встроен"
          hint="Когда встраивание случится, здесь заиграет ровно та сборка, что уйдёт в релиз, — без отдельного плеера. Кнопка запуска пока недоступна: движок ещё не встроен."
          actionLabel="Запустить превью"
          actionKind="outline"
        />
      </div>

      <div className={styles.section}>
        <div className={styles.kicker}>Параметры запуска</div>
        <div className={preview.frame}>
          <div className={preview.controlsRow}>
            <PreviewControls branch={branchSummary} seed={seed != null ? String(seed) : '—'} disabled />
            <StrictModeToggle checked={strict} onChange={setStrict} />
          </div>

          <div className={preview.viewportWrap}>
            <GameViewport bg="кадр партии — заглушка, пока движок не встроен" showChar={false} showDialogue={false} />
          </div>

          <FlagsSeed flagsLabel="ветки:" flags={branchFlags} seedLabel={seedLabel} onDark />
        </div>
      </div>
    </div>
  );
};

export default PreviewZone;
