import React from 'react';

import Frame from '../atoms/Frame';
import IconButton from '../atoms/IconButton';
import MonoText from '../atoms/MonoText';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';
import Waveform from '../atoms/Waveform';

import styles from './TrackRow.module.css';

export interface TrackRowProps {
  /** Подпись дубля, например «Вариант A». */
  label: string;
  /** Таймкод длительности, например «2:47». */
  time: string;
  selected?: boolean;
  /** Клик по всей строке выбирает дубль. Без колбэка строка — немой индикатор. */
  onSelect?: () => void;
  /** Клик по кнопке ▶; не всплывает до выбора строки. */
  onPlay?: () => void;
}

/**
 * Порт `design_ref/components/TrackRow.dc.html` (molecules.json#p006,
 * «СТРОКА ТРЕКА A/B»).
 * Строка дубля в списке вариантов: радио-кружок, подпись, таймкод, полоса
 * волны и кнопка воспроизведения — выбор дубля кликом по всей строке, клик
 * по «play» до выбора не всплывает. Кружок-индикатор собран локально, а не
 * атомом `Radio`: тот сам несёт `role="radio"`/`aria-checked` на своей
 * обёртке, а в исходнике этим же семантическим слоем уже помечена строка
 * целиком — вложенный второй `role="radio"` задвоил бы состояние и сломал бы
 * однозначный `getByRole('radio')` (см. `missingAtoms` отчёта задачи). Сама
 * строка — не `<button>`, а `div[role="radio"]`: внутри уже лежит настоящая
 * кнопка воспроизведения (`IconButton`), а `<button>` в `<button>` невалиден —
 * то же решение, что и в `BeatRow`. Подпись и таймкод берут ближайшие тона
 * атомов (`TextLabel` — `muted`/жирный `normal`, `MonoText` — `muted`);
 * точные оттенки макета (`--color-neutral-700`/`600`/`500`) через эти тона не
 * воспроизводятся буква в букву, но семантически совпадают.
 */
const TrackRow = ({ label, time, selected = false, onSelect, onPlay }: TrackRowProps) => {
  const clickable = Boolean(onSelect);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  const stopPlaySlotClick = (event: React.MouseEvent) => event.stopPropagation();

  const dialClassName = [styles.dial, selected ? styles.dialChecked : ''].filter(Boolean).join(' ');

  const body = (
    <>
      <span className={dialClassName} aria-hidden="true">
        {selected && <span className={styles.dot} />}
      </span>
      <span className={styles.label}>
        <TextLabel text={label} tone={selected ? 'normal' : 'muted'} bold={selected} />
      </span>
      <span className={styles.time}>
        <MonoText text={time} muted />
      </span>
      <span className={styles.waveSlot}>
        <Waveform variant={selected ? 'active' : 'muted'} />
      </span>
      <span className={styles.playSlot} onClick={stopPlaySlotClick}>
        <IconButton glyph="▶" hint="воспроизвести" onClick={onPlay} />
      </span>
    </>
  );

  const rowClassName = [styles.row, clickable ? styles.clickable : '', selected ? styles.rowSelected : '']
    .filter(Boolean)
    .join(' ');

  const row = clickable ? (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      className={rowClassName}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      {body}
    </div>
  ) : (
    <div role="radio" aria-checked={selected} className={rowClassName}>
      {body}
    </div>
  );

  const filled = selected ? (
    <span className={styles.toneStretch}>
      <ToneSurface tone="accent" padding={0}>
        {row}
      </ToneSurface>
    </span>
  ) : (
    row
  );

  return (
    <Frame tone="light" selected={selected} interactive={false} block padding={0}>
      {filled}
    </Frame>
  );
};

export default TrackRow;
