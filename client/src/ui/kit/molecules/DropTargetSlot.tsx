import React from 'react';

import AccentText from '../atoms/AccentText';
import DashedFrame, { type DashedFrameKind } from '../atoms/DashedFrame';

import styles from './DropTargetSlot.module.css';

export interface DropTargetSlotProps {
  /** Подпись слота: что сюда переносят и в каком он состоянии. */
  label: string;
  /** Слот занят — рамка и подпись переходят на сигнал ошибки, вытесняя `active`. */
  busy?: boolean;
  /** Слот сейчас цель переноса и готов принять объект. */
  active?: boolean;
  onDark?: boolean;
  /** Ширина в px; без значения слот растягивается на всю ширину контейнера. */
  width?: number;
}

/**
 * Порт `design_ref/components/DropTargetSlot.dc.html` (molecules.json#s005,
 * «ЦЕЛЬ ПЕРЕНОСА (СЛОТ)»). Пунктирная мишень drag-and-drop: свободна и готова
 * принять перенос (`active`), занята чем-то другим (`busy`, сильнее `active`)
 * либо выключена из оборота (ни то ни другое). Сама по себе некликабельна —
 * оператор ничего не жмёт, слот только показывает состояние. Собрана из
 * `DashedFrame` (вид рамки кодирует то же состояние: `add` — активна,
 * `missing` — занята, `note` — нейтральна) и `AccentText` (подпись сигналом);
 * нейтральное состояние не покрыто тоном `AccentText`, поэтому у него
 * собственный приглушённый текст.
 */
const DropTargetSlot = ({ label, busy = false, active = true, onDark = false, width }: DropTargetSlotProps) => {
  const kind: DashedFrameKind = busy ? 'missing' : active ? 'add' : 'note';

  return (
    <DashedFrame kind={kind} onDark={onDark} interactive={false} padding={0}>
      <div className={styles.slot} style={{ width: width ? `${width}px` : '100%' }}>
        {busy || active ? (
          <AccentText text={label} tone={busy ? 'error' : 'info'} onDark={onDark} size={9.5} />
        ) : (
          <span className={[styles.neutral, onDark ? styles.onDark : ''].filter(Boolean).join(' ')}>{label}</span>
        )}
      </div>
    </DashedFrame>
  );
};

export default DropTargetSlot;
