import React from 'react';

import DashedFrame from '../atoms/DashedFrame';
import Frame from '../atoms/Frame';
import TextLabel from '../atoms/TextLabel';
import ToneSurface from '../atoms/ToneSurface';

import styles from './LadderSteps.module.css';

/** Состояние ступени, выведенное из её номера относительно `done`/`current`. */
export type LadderStepStatus = 'сыграна' | 'открыта' | 'заперта';

export interface LadderStepsProps {
  /** Сколько ступеней в ряду. */
  count?: number;
  /** Номер последней сыгранной ступени включительно — ступени `1..done` залиты. */
  done?: number;
  /** Номер открытой сейчас ступени. */
  current?: number;
  /** Буква перед номером ступени: «С1», «С2» … */
  prefix?: string;
  /** Пояснение под рядом — что сыграно, что открыто, чем заперто дальнейшее. Пусто — строка не рисуется. */
  note?: string;
  onDark?: boolean;
  /** Клик по ступени (любой — сыгранной, открытой или запертой). Без колбэка ряд не кликабелен. */
  onStep?: (step: number) => void;
}

const statusFor = (step: number, done: number, current: number): LadderStepStatus => {
  if (step <= done) return 'сыграна';
  if (step === current) return 'открыта';
  return 'заперта';
};

/**
 * Порт `design_ref/components/LadderSteps.dc.html` (molecules.json#p035, «СТУПЕНИ ЛЕСТНИЦЫ»).
 * Ряд ступеней локации/арки: сыгранные залиты, открытая сейчас обведена акцентом,
 * запертые дальше — пунктиром. Состояние каждой ступени выводится из `done`/`current`,
 * а не приходит списком — ступени однородны, различается только номер.
 */
const LadderSteps = ({
  count = 5,
  done = 2,
  current = 3,
  prefix = 'С',
  note = '',
  onDark = false,
  onStep,
}: LadderStepsProps) => {
  const steps = Array.from({ length: Math.max(0, count) }, (_, idx) => idx + 1);

  return (
    <div className={styles.root}>
      <div className={styles.row}>
        {steps.map(step => {
          const label = `${prefix}${step}`;
          const status = statusFor(step, done, current);
          const handleClick = onStep ? () => onStep(step) : undefined;

          if (status === 'открыта') {
            return (
              <div className={styles.cell} key={step}>
                <Frame tone="accent" padding={4} block interactive={Boolean(handleClick)} onClick={handleClick}>
                  <TextLabel text={label} onDark={onDark} tone="accent" size={9.5} />
                </Frame>
              </div>
            );
          }

          const surface =
            status === 'сыграна' ? (
              <ToneSurface tone="accent700" padding={4}>
                <TextLabel text={label} onDark bold size={9.5} />
              </ToneSurface>
            ) : (
              <DashedFrame kind="note" onDark={onDark} padding={4}>
                <TextLabel text={label} onDark={onDark} tone="muted" size={9.5} />
              </DashedFrame>
            );

          return (
            <div className={styles.cell} key={step}>
              {handleClick ? (
                <button type="button" className={styles.cellButton} onClick={handleClick}>
                  {surface}
                </button>
              ) : (
                surface
              )}
            </div>
          );
        })}
      </div>
      {note !== '' && (
        <div className={styles.note}>
          <TextLabel text={note} onDark={onDark} tone="muted" size={10} />
        </div>
      )}
    </div>
  );
};

export default LadderSteps;
