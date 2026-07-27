import React, { useEffect, useRef, useState } from 'react';

import { formatLogTime, useRunLog } from '@/narrative/runLog';
import ConsoleLine from '@/ui/ConsoleLine';

import styles from './panels.module.css';

export interface ConsolePanelProps {
  /** Прогон идёт: последняя строка получает мигающий курсор. */
  running: boolean;
}

/** Консоль генерации: живой лог прогона с автоскроллом. */
const ConsolePanel = ({ running }: ConsolePanelProps) => {
  const lines = useRunLog(s => s.lines);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Пользователь отлистал вверх — не дёргаем его обратно вниз.
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    if (!stickToBottom) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, stickToBottom]);

  return (
    <div
      className={styles.consoleBody}
      ref={bodyRef}
      onScroll={event => {
        const el = event.currentTarget;
        setStickToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
      }}
    >
      {lines.length === 0 && <div className={styles.placeholder}>Лог пуст — запустите генерацию.</div>}
      {lines.map((line, index) => (
        <ConsoleLine
          key={`${line.t}-${index}`}
          time={formatLogTime(line.t)}
          text={line.text}
          tone={line.tone}
          cursor={running && index === lines.length - 1}
        />
      ))}
    </div>
  );
};

export default ConsolePanel;
