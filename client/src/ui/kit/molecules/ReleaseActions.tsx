import React from 'react';

import OutlineButton from '../atoms/OutlineButton';

import styles from './ReleaseActions.module.css';

export interface ReleaseAction {
  label: string;
  /** Акцентный тон (контур и текст цвета accent) вместо нейтрального. */
  accent?: boolean;
}

export interface ReleaseActionsProps {
  /** Ряд кнопок-чипов слева направо. */
  items: ReleaseAction[];
  /** Запирает весь ряд разом — как в макете, где диз-эйбл общий на компонент. */
  disabled?: boolean;
  onDark?: boolean;
  /** Зовётся с индексом и подписью нажатой кнопки. */
  onPick?: (index: number, label: string) => void;
}

/**
 * Порт `design_ref/components/ReleaseActions.dc.html` (molecules.json#k096,
 * «ЧИПЫ ДЕЙСТВИЙ РЕЛИЗА»). Ряд контурных кнопок над готовым релизом: обычные
 * действия нейтральным контуром, главное — акцентным. Каждая кнопка это
 * `OutlineButton` компактного размера, молекула только раскладывает их в ряд
 * и разводит клики по индексу.
 */
const ReleaseActions = ({ items, disabled = false, onDark = false, onPick }: ReleaseActionsProps) => (
  <div className={styles.root}>
    {items.map((item, index) => (
      <OutlineButton
        key={`${index}-${item.label}`}
        label={item.label}
        tone={item.accent ? 'accent' : 'neutral'}
        size="compact"
        onDark={onDark}
        disabled={disabled}
        onClick={onPick ? () => onPick(index, item.label) : undefined}
      />
    ))}
  </div>
);

export default ReleaseActions;
