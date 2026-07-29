import React from 'react';

import AccentText from '../atoms/AccentText';
import Input from '../atoms/Input';
import Kicker from '../atoms/Kicker';
import MutedText from '../atoms/MutedText';

import styles from './LabeledField.module.css';

export type LabeledFieldArrow = 'down' | 'updown' | 'none';

export interface LabeledFieldProps {
  label: string;
  /** Начальное содержимое поля; передаётся неконтролируемому `Input` как есть. */
  value?: string;
  arrow?: LabeledFieldArrow;
  /** Добавляет «*» к лейблу — поле обязательно к заполнению. */
  required?: boolean;
  error?: boolean;
  hint?: string;
  /** Текст под ошибкой; если не задан, используется `hint`, а затем общий фолбэк. */
  errorHint?: string;
  /** px, 110–500 в макете. */
  width?: number;
  onChange?: (value: string) => void;
}

const ARROW_GLYPH: Record<LabeledFieldArrow, string> = {
  down: '▾',
  updown: '▴▾',
  none: '',
};

const DEFAULT_ERROR_HINT = 'обязательное поле';

/**
 * Порт `design_ref/components/LabeledField.dc.html` (molecules.json#p012).
 * Поле с лейблом: кикер-подпись, значение в hairline-рамке со стрелкой раскрытия
 * и подсказка снизу. Ошибка красит лейбл и рамку и подменяет подсказку текстом
 * ошибки (тот же приоритет, что в исходнике: `errorHint` → `hint` → фолбэк).
 */
const LabeledField = ({
  label,
  value,
  arrow = 'down',
  required = false,
  error = false,
  hint = '',
  errorHint,
  width = 200,
  onChange,
}: LabeledFieldProps) => {
  const labelText = required ? `${label} *` : label;
  const hasArrow = arrow !== 'none';
  const resolvedHint = error ? errorHint || hint || DEFAULT_ERROR_HINT : hint;
  const hasHint = !!resolvedHint;
  const boxClassName = [styles.box, hasArrow ? styles.hasArrow : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <div className={styles.kicker}>
        <Kicker text={labelText} tone={error ? 'error' : 'neutral'} />
      </div>
      <div className={boxClassName}>
        <Input value={value} placeholder={error && !value ? '—' : undefined} error={error} onChange={onChange} />
        {hasArrow && (
          <span className={styles.arrow} aria-hidden="true">
            {ARROW_GLYPH[arrow]}
          </span>
        )}
      </div>
      {hasHint && (
        <div className={styles.hint}>
          {error ? (
            <AccentText text={resolvedHint} tone="error" size={9.5} />
          ) : (
            <MutedText text={resolvedHint} size={9.5} />
          )}
        </div>
      )}
    </div>
  );
};

export default LabeledField;
