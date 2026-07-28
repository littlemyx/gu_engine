import React from 'react';

import Chip from '../atoms/Chip';
import CornerMarks from '../atoms/CornerMarks';
import Cursor from '../atoms/Cursor';
import Kicker from '../atoms/Kicker';
import OutlineButton from '../atoms/OutlineButton';
import PrimaryButton from '../atoms/PrimaryButton';

import styles from './BriefGenPanel.module.css';

export type BriefGenPhase = 'idle' | 'parsing' | 'filling' | 'done' | 'retry';

export interface BriefGenDirective {
  /** Поле брифа, в которое легла заметка: «тон», «сеттинг», «LI Кира». */
  target: string;
  /** Сама директива, как её вычленил разбор. */
  text: string;
}

export interface BriefGenPanelProps {
  phase?: BriefGenPhase;
  /** Свободный текст заметок автора — то, с чего начинается генерация. */
  notes: string;
  /** Директивы, на которые разобрались заметки. Показываются не на `idle`. */
  directives?: BriefGenDirective[];
  /** Сколько директив легло на уже заполненные поля и было отброшено. */
  droppedCount?: string;
  /** 1–5: объём прозы полей, структуру не трогает. */
  verbosity?: number;
  gaps?: number;
  filled?: number;
  /** «2/3» — номер попытки ретрая из максимума. */
  attempt?: string;
  price?: string;
  /** Фиксированная ширина панели, px. Без пропа растягивается на 100%. */
  width?: number;
  onGenerate?: () => void;
  onRollback?: () => void;
}

const STATUS_CLASS: Record<'idle' | 'running' | 'retry', string> = {
  idle: styles.statusIdle,
  running: styles.statusActive,
  retry: styles.statusRetry,
};

const NOTE_CLASS: Record<'default' | 'retry', string> = {
  default: styles.noteDefault,
  retry: styles.noteRetry,
};

type PhaseKey = 'parsing' | 'filling' | 'done';

const PHASE_DEFS: { key: PhaseKey; label: string; arrow: boolean }[] = [
  { key: 'parsing', label: 'разбор заметок', arrow: true },
  { key: 'filling', label: 'заполнение пробелов', arrow: true },
  { key: 'done', label: 'проверьте и поправьте', arrow: false },
];

const PHASE_ORDER: Record<PhaseKey, number> = { parsing: 1, filling: 2, done: 3 };

/**
 * Порт `design_ref/components/BriefGenPanel.dc.html` (molecules.json#s017).
 * Панель генерации брифа: LLM заполняет только пробелы. Заметки автора →
 * директивы по полям → фазы разбора/заполнения → «проверьте и поправьте»,
 * с ретраем по фидбеку и откатом снимка после готовности.
 */
const BriefGenPanel = ({
  phase = 'idle',
  notes,
  directives = [],
  droppedCount = '',
  verbosity = 3,
  gaps = 9,
  filled = 6,
  attempt = '2/3',
  price = '',
  width = 640,
  onGenerate,
  onRollback,
}: BriefGenPanelProps) => {
  const idle = phase === 'idle';
  const parsing = phase === 'parsing';
  const filling = phase === 'filling';
  const done = phase === 'done';
  const retry = phase === 'retry';
  const running = parsing || filling || retry;
  const v = Math.max(1, Math.min(5, verbosity));

  const hasDirectives = !idle && directives.length > 0;
  const hasDropped = !!droppedCount;

  const statusText = idle
    ? 'смета на кнопке — до клика'
    : parsing
    ? 'фаза 1/2 · разбор заметок'
    : filling
    ? `фаза 2/2 · заполнение · ${filled} из ${gaps} полей`
    : done
    ? `✓ заполнено ${gaps} полей — проверьте и поправьте`
    : `попытка ${attempt} · ошибки проверки уехали в фидбек`;
  const statusTone: 'idle' | 'running' | 'retry' = idle ? 'idle' : retry ? 'retry' : 'running';

  const note = idle
    ? 'заполненное вами руками — неприкосновенно · «авто»-поля решит генератор'
    : parsing
    ? 'каталог полей отдаётся целиком — лучше отбросить лишнюю директиву, чем потерять фразу'
    : filling
    ? 'результат ложится прямо в поля — форма и есть предпросмотр · правка руками не перезаписывается'
    : done
    ? 'стоимость уехала в счётчик проекта · «Откатить» вернёт снимок до генерации'
    : 'до 3 попыток · применится лучшая по минимуму ошибок';

  const buttonLabel = idle
    ? 'Заполнить пробелы'
    : retry
    ? `Попытка ${attempt}…`
    : filling
    ? `Заполняем ${filled}/${gaps}…`
    : 'Разбор заметок…';

  const currentPhaseOrder = parsing ? 1 : filling || retry ? 2 : done ? 3 : 0;

  return (
    <CornerMarks tone="plain">
      <div
        className={[styles.panel, running ? styles.panelRunning : done ? styles.panelDone : '']
          .filter(Boolean)
          .join(' ')}
        style={{ width: `${width}px` }}
      >
        <div className={styles.headerRow}>
          <Kicker text="ГЕНЕРАЦИЯ БРИФА · ЗАПОЛНЯЕТ ТОЛЬКО ПРОБЕЛЫ" tone="neutral" size={9} />
          <span className={`${styles.status} ${STATUS_CLASS[statusTone]}`}>
            {running && (
              <span className={styles.spinner} aria-hidden="true">
                ⟳
              </span>
            )}
            {statusText}
          </span>
        </div>

        <div className={styles.notesBlock}>
          <Kicker
            text="ЗАМЕТКИ АВТОРА · свалите сюда всё: сеттинг, вайбы, обрывки характеров"
            tone="neutral"
            size={9}
          />
          <div className={`${styles.notesBox} ${idle ? styles.notesIdle : styles.notesRunning}`}>
            {notes}
            {idle && <Cursor tone="accent" size={11} />}
          </div>
        </div>

        {hasDirectives && (
          <div className={styles.directivesRow}>
            <Kicker text="ЗАМЕТКИ РАЗЛОЖЕНЫ В ДИРЕКТИВЫ ПО ПОЛЯМ →" tone="neutral" size={9} />
            {directives.map((d, i) => (
              <Chip key={`${d.target}-${i}`} label={`${d.target} «${d.text}»`} kind="tinted" />
            ))}
            {hasDropped && <span className={styles.droppedText}>+{droppedCount} на заполненные — отброшены</span>}
          </div>
        )}

        <div className={styles.controlsRow}>
          <div className={styles.verbosityGroup}>
            <Kicker text="ПОДРОБНОСТЬ" tone="neutral" size={9} />
            <span className={styles.ticks}>
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={`${styles.tick} ${i <= v ? styles.tickActive : ''}`} />
              ))}
            </span>
            <span className={styles.verbosityValue}>{v}/5</span>
            <span className={styles.verbosityHint}>объём прозы полей · структуру не трогает</span>
          </div>
          <div className={styles.actions}>
            {done && <OutlineButton label="Откатить" tone="accent" size="compact" onClick={onRollback} />}
            {!done && (
              <PrimaryButton
                label={buttonLabel}
                price={idle ? price : ''}
                size="compact"
                disabled={running}
                onClick={onGenerate}
              />
            )}
          </div>
        </div>

        <div className={styles.phasesRow}>
          {PHASE_DEFS.map(p => {
            const me = PHASE_ORDER[p.key];
            const isDone = currentPhaseOrder > me;
            const isCurrent = currentPhaseOrder === me;
            const phaseClass = isDone ? styles.phaseDone : isCurrent ? styles.phaseCurrent : styles.phaseFuture;
            return (
              <span key={p.key} className={`${styles.phaseItem} ${phaseClass}`}>
                <span>{isDone ? '✓' : isCurrent ? '▸' : '·'}</span>
                <span>{p.label}</span>
                {p.arrow && <span className={styles.phaseArrow}>→</span>}
              </span>
            );
          })}
          <span className={`${styles.note} ${NOTE_CLASS[retry ? 'retry' : 'default']}`}>{note}</span>
        </div>
      </div>
    </CornerMarks>
  );
};

export default BriefGenPanel;
