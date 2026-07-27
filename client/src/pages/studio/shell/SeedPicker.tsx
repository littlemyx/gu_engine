import React, { useEffect, useRef, useState } from 'react';

import styles from './SeedPicker.module.css';

export interface SeedPickerProps {
  /** Текущий seed брифа. null — прогон ещё ни разу его не фиксировал. */
  seed: number | null;
  disabled?: boolean;
  /** Поповер раскрывается вверх — для триггера в статус-баре (макет 7h). */
  up?: boolean;
  onChange: (seed: number) => void;
}

const randomSeed = (): number => Math.floor(Math.random() * 1_000_000) + 1;

/**
 * Seed детерминированных шагов генерации: по нему строится расписание
 * персонажей. Тексты пишет LLM без seed-а, поэтому прогон целиком он не
 * воспроизводит — об этом сказано прямо в подсказке, чтобы на него не
 * рассчитывали как на «сделать точно так же».
 */
const SeedPicker = ({ seed, disabled = false, up = false, onChange }: SeedPickerProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(seed ?? ''));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(String(seed ?? '')), [seed]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const commit = (value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && value.trim() !== '') onChange(parsed);
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
      >
        {seed == null ? '—' : String(seed)} {up ? '▴' : '▾'}
      </button>

      {open && (
        <div className={`${styles.popover} ${up ? styles.popoverUp : ''}`} role="dialog" aria-label="Seed генерации">
          <label className={styles.field}>
            <span className={styles.label}>Seed</span>
            <input
              className={styles.input}
              type="number"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onBlur={event => commit(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  commit(draft);
                  setOpen(false);
                }
              }}
            />
          </label>

          <button
            type="button"
            className={styles.action}
            onClick={() => {
              const next = randomSeed();
              setDraft(String(next));
              onChange(next);
            }}
          >
            Перебросить
          </button>

          <p className={styles.hint}>
            Определяет расписание персонажей: один и тот же seed даёт одну и ту же раскладку встреч. Тексты пишет модель
            без seed-а — дословно прогон он не повторит.
          </p>
        </div>
      )}
    </div>
  );
};

export default SeedPicker;
