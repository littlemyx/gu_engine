import React from 'react';

import { computeBriefGaps } from '@/narrative/briefGaps';
import { useBriefStore } from '@/narrative/briefStore';
import {
  clampVerbosity,
  VERBOSITY_DEFAULT,
  VERBOSITY_LABELS,
  VERBOSITY_MAX,
  VERBOSITY_MIN,
} from '@/narrative/briefVerbosity';
import { BRIEF_GEN_COST_EST, formatCost } from '@/narrative/costModel';
import { useBriefGeneration, type BriefGeneration } from '@/narrative/useBriefGeneration';
import ActionButton from '@/ui/ActionButton';
import { pluralize } from '@/ui/plural';

import styles from './modals.module.css';

export interface BriefGeneratePanelProps {
  /** Прогон идёт — форма ниже приглушается, пока результат не применён. */
  onRunningChange?: (running: boolean) => void;
}

function statusLine(gen: BriefGeneration, filled: string): string {
  switch (gen.phase) {
    case 'parsing_hint':
      return 'Разбираю заметки…';
    case 'filling':
      return `Заполняю бриф… попытка ${gen.attempt}/3`;
    case 'done':
      return `Готово, заполнено ${filled}. Проверьте и поправьте, что не так.`;
    case 'error':
      return `Не вышло: ${gen.error}`;
    default:
      return '';
  }
}

/**
 * Дозаполнение брифа генератором. Панель живёт над формой, а не вместо неё:
 * результат приземляется прямо в поля, и вычитывает его автор в той же
 * модалке — отдельного экрана «предпросмотр» нет, потому что форма и есть
 * лучший предпросмотр брифа.
 */
const BriefGeneratePanel = ({ onRunningChange }: BriefGeneratePanelProps) => {
  const brief = useBriefStore(s => s.brief);
  const gen = useBriefGeneration();

  const [hint, setHint] = React.useState('');
  const [verbosity, setVerbosity] = React.useState(VERBOSITY_DEFAULT);

  const gaps = React.useMemo(() => computeBriefGaps(brief), [brief]);

  React.useEffect(() => {
    onRunningChange?.(gen.running);
  }, [gen.running, onRunningChange]);

  const estimate = BRIEF_GEN_COST_EST.fill + (hint.trim() ? BRIEF_GEN_COST_EST.hintParse : 0);
  const status = statusLine(gen, pluralize(gen.filled, 'поле', 'поля', 'полей'));

  return (
    <section className={styles.genPanel}>
      <header className={styles.genHeader}>
        <h3 className={styles.genTitle}>Сгенерировать бриф</h3>
        <span className={styles.genMeta}>
          {gaps.length > 0
            ? `${pluralize(gaps.length, 'пустое поле', 'пустых поля', 'пустых полей')} — генератор трогает только их`
            : 'пустых полей нет'}
        </span>
      </header>

      <label className={styles.field}>
        <span className={styles.label}>Заметки автора (необязательно)</span>
        <textarea
          className={styles.genTextarea}
          value={hint}
          disabled={gen.running}
          onChange={e => setHint(e.target.value)}
          placeholder="Свалите сюда всё: сеттинг, вайбы, обрывки характеров, пожелания по стилю. Пусто — генератор придумает сам."
          rows={3}
        />
      </label>

      <div className={styles.genVerbosity}>
        <span className={styles.label}>Подробность</span>
        <input
          type="range"
          className={styles.weightRange}
          min={VERBOSITY_MIN}
          max={VERBOSITY_MAX}
          step={1}
          value={verbosity}
          disabled={gen.running}
          onChange={e => setVerbosity(clampVerbosity(Number(e.target.value)))}
        />
        <span className={styles.genVerbosityValue}>{VERBOSITY_LABELS[verbosity]}</span>
      </div>

      <div className={styles.genActions}>
        <ActionButton
          onLight
          label={gen.running ? 'Генерирую…' : 'Сгенерировать'}
          cost={gen.running ? undefined : `≈ ${formatCost(estimate)}`}
          disabled={gen.running || gaps.length === 0}
          reason={gaps.length === 0 ? 'все поля брифа заполнены' : undefined}
          onClick={() => void gen.generate(hint, verbosity)}
        />
        {gen.running && <ActionButton onLight kind="ghost" label="Отмена" onClick={gen.cancel} />}
        {!gen.running && gen.canUndo && <ActionButton onLight kind="outline" label="Откатить" onClick={gen.undo} />}
        {status && (
          <span className={`${styles.genStatus} ${gen.phase === 'error' ? styles.genStatusError : ''}`}>{status}</span>
        )}
      </div>
    </section>
  );
};

export default BriefGeneratePanel;
