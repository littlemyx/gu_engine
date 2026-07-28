import React from 'react';

import Frame from '../atoms/Frame';
import Input from '../atoms/Input';
import Kicker from '../atoms/Kicker';
import MutedText from '../atoms/MutedText';
import OutlineButton from '../atoms/OutlineButton';
import Shadow from '../atoms/Shadow';

import styles from './Popover.module.css';

export interface PopoverProps {
  /** Подпись анкера-триггера, напр. «seed 91427». */
  anchor: string;
  /** Надзаголовок панели, напр. «Seed прогона». */
  kicker: string;
  /** Значение поля ввода. */
  value?: string;
  /** Подпись кнопки действия, напр. «Перебросить». */
  actionLabel: string;
  /** Пояснение под полем ввода. */
  hint: string;
  /** Панель раскрыта. */
  open?: boolean;
  onToggle?: () => void;
  /** Анкер стоит на тёмном хроме — панель остаётся светлой, как в макете. */
  onDark?: boolean;
  /** Ширина панели в px; в макете диапазон 180–360, по умолчанию 220. */
  width?: number;
  onAction?: () => void;
  onChange?: (value: string) => void;
}

/**
 * Порт `design_ref/components/Popover.dc.html` (molecules.json#p037, «ПОПОВЕР»).
 * Текстовый анкер с глифом раскрытия и всплывающая панель под ним: кикер,
 * поле ввода + кнопка-действие, пояснение. Панель — светлая карточка поверх
 * рабочей области независимо от `onDark`: в макете её кикер и хинт несут
 * фиксированный цвет, а не переключаются вместе с контекстом анкера.
 */
const Popover = ({
  anchor,
  kicker,
  value,
  actionLabel,
  hint,
  open = true,
  onToggle,
  onDark = false,
  width = 220,
  onAction,
  onChange,
}: PopoverProps) => {
  const anchorClassName = [styles.anchor, onDark ? styles.onDark : ''].filter(Boolean).join(' ');
  const anchorText = `${anchor} ${open ? '▴' : '▾'}`;

  const anchorNode = onToggle ? (
    <button type="button" className={anchorClassName} aria-expanded={open} onClick={onToggle}>
      {anchorText}
    </button>
  ) : (
    <span className={anchorClassName}>{anchorText}</span>
  );

  return (
    <div className={styles.root}>
      {anchorNode}
      {open && (
        <div className={styles.panelWrap}>
          <Shadow size="md">
            <Frame tone="light" padding={0} interactive={false}>
              <div className={styles.panel} style={{ width: `${width}px` }}>
                <div className={styles.kickerRow}>
                  <Kicker text={kicker} size={9.5} />
                </div>
                <div className={styles.row}>
                  <div className={styles.inputWrap}>
                    <Input value={value} mono onChange={onChange} />
                  </div>
                  <OutlineButton label={actionLabel} tone="accent" size="compact" onClick={onAction} />
                </div>
                <div className={styles.hintRow}>
                  <MutedText text={hint} size={9.5} />
                </div>
              </div>
            </Frame>
          </Shadow>
        </div>
      )}
    </div>
  );
};

export default Popover;
