import React from 'react';

import TextLabel from '../atoms/TextLabel';

import styles from './DecisionRow.module.css';

export type DecisionRowChoice = 'нет' | 'моё' | 'дубль';

export interface DecisionRowProps {
  /** Что разошлось и что выбрать, напр. «beat_prose/b5 — ваша правка, но изменился Б4». */
  text: string;
  /** Подпись кнопки «оставить моё». */
  keepLabel?: string;
  /** Подпись кнопки дубля вместе со сметой, напр. «дубль ≈$0.02» — цена уже в строке. */
  redoLabel?: string;
  /** Текущий выбор; «нет» — решение ещё не принято. */
  chosen?: DecisionRowChoice;
  /** Без колбэка строка нерактивна — обе кнопки становятся неинтерактивными. */
  onPick?: (choice: 'моё' | 'дубль') => void;
}

interface DecisionOption {
  id: 'моё' | 'дубль';
  label: string;
  accent: boolean;
}

/**
 * Порт `design_ref/components/DecisionRow.dc.html` (molecules.json#k040,
 * «СТРОКА РЕШЕНИЯ · ✎ + ◐»).
 * Строка конфликта правок: описание того, что разошлось, и две кнопки —
 * оставить свою правку или сгенерировать платный дубль. Выбор держится до
 * следующего клика заливкой кнопки, а не отдельным индикатором.
 */
const DecisionRow = ({
  text,
  keepLabel = 'оставить моё',
  redoLabel = 'дубль ≈$0.02',
  chosen = 'нет',
  onPick,
}: DecisionRowProps) => {
  const options: DecisionOption[] = [
    { id: 'моё', label: keepLabel, accent: false },
    { id: 'дубль', label: redoLabel, accent: true },
  ];

  return (
    <div className={styles.root}>
      <span className={styles.text}>
        <TextLabel text={text} size={10.5} />
      </span>
      {options.map(option => {
        const selected = chosen === option.id;
        const className = [
          styles.option,
          option.accent ? styles.accent : styles.neutral,
          selected ? styles.selected : '',
        ]
          .filter(Boolean)
          .join(' ');

        if (!onPick) {
          return (
            <span key={option.id} className={className} aria-pressed={selected}>
              {option.label}
            </span>
          );
        }

        return (
          <button
            key={option.id}
            type="button"
            className={className}
            aria-pressed={selected}
            onClick={() => onPick(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default DecisionRow;
