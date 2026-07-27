import React from 'react';

import styles from './ConsoleLine.module.css';

export type ConsoleTone = 'info' | 'ok' | 'error' | 'run' | 'pending';

export interface ConsoleLineProps {
  time: string;
  text: string;
  tone?: ConsoleTone;
  /** Мигающий курсор на последней строке живого прогона. */
  cursor?: boolean;
}

const TONE_CLASS: Record<ConsoleTone, string> = {
  info: '',
  ok: '',
  error: styles.error,
  run: styles.run,
  pending: styles.pending,
};

/** Строка «Консоли генерации». */
const ConsoleLine = ({ time, text, tone = 'info', cursor = false }: ConsoleLineProps) => (
  <div className={`${styles.root} ${TONE_CLASS[tone] ?? ''}`.trim()}>{`[${time}] ${text}${cursor ? ' ▌' : ''}`}</div>
);

export default ConsoleLine;
