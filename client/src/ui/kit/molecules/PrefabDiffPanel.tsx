import React from 'react';

import Frame from '../atoms/Frame';
import Heading from '../atoms/Heading';
import MutedText from '../atoms/MutedText';
import OutlineButton from '../atoms/OutlineButton';
import PrimaryButton from '../atoms/PrimaryButton';
import TextLabel from '../atoms/TextLabel';

import styles from './PrefabDiffPanel.module.css';

export interface PrefabDiffPanelProps {
  /** Заголовок панели: «Кира: v2 (закастована) → v3 (в библиотеке)». */
  title: string;
  /** Короткая пояснительная строка справа от заголовка. */
  note: string;
  /**
   * Тело диффа. Если не передано, панель показывает `conflict` — строку с
   * описанием конфликта, который нельзя смержить автоматически.
   */
  children?: React.ReactNode;
  /** Текст-заглушка тела, когда содержимого диффа нет. */
  conflict: string;
  /** Подпись кнопки принятия новой версии. */
  takeLabel: string;
  /** Подпись кнопки остаться на текущей версии. */
  stayLabel: string;
  /** Необязательная сноска у правого края строки кнопок. */
  footnote?: string;
  onTake?: () => void;
  onStay?: () => void;
}

/**
 * Порт `design_ref/components/PrefabDiffPanel.dc.html` (molecules.json#k029).
 * Панель диффа версий префаба на границе апгрейда: заголовок с меткой,
 * тело-дифф (или текст конфликта, если мержить нечего) и пара решений —
 * взять новую версию с ручным оверрайдом или остаться на старой.
 */
const PrefabDiffPanel = ({
  title,
  note,
  children,
  conflict,
  takeLabel,
  stayLabel,
  footnote,
  onTake,
  onStay,
}: PrefabDiffPanelProps) => {
  return (
    <Frame tone="accent" padding={0} interactive={false}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <Heading text={title} level="card" uppercase={false} size={12.5} />
          <span className={styles.note}>
            <MutedText text={note} size={9.5} />
          </span>
        </div>
        <div className={styles.body}>{children ?? <TextLabel text={conflict} size={10.5} />}</div>
        <div className={styles.actions}>
          <PrimaryButton label={takeLabel} size="compact" marks={false} onClick={onTake} />
          <OutlineButton label={stayLabel} size="compact" onClick={onStay} />
          {footnote && (
            <span className={styles.footnote}>
              <MutedText text={footnote} size={9.5} />
            </span>
          )}
        </div>
      </div>
    </Frame>
  );
};

export default PrefabDiffPanel;
