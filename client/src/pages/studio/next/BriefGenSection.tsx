import React, { useMemo, useState } from 'react';

import { computeBriefGaps } from '@/narrative/briefGaps';
import { VERBOSITY_DEFAULT, clampVerbosity } from '@/narrative/briefVerbosity';
import { BRIEF_GEN_COST_EST, formatCost } from '@/narrative/costModel';
import BriefGenPanel from '@/ui/kit/molecules/BriefGenPanel';

import styles from './briefZone.module.css';

import type { BriefGeneration } from '@/narrative/useBriefGeneration';
import type { Brief } from '@/narrative/types';
import type { BriefGenPhase } from '@/ui/kit/molecules/BriefGenPanel';

export interface BriefGenSectionProps {
  brief: Brief;
  /** Хук генерации живёт у зоны: состояние «идёт» нужно и карточкам полей. */
  gen: BriefGeneration;
}

/**
 * Панель s017 «как в макете», но живая: та же механика, что была в модалке
 * (useBriefGeneration — пробелы, директивы из заметок, до 3 попыток, откат),
 * просто теперь она стоит в зоне «Замысел» над карточками полей.
 */
function panelPhase(gen: BriefGeneration): BriefGenPhase {
  switch (gen.phase) {
    case 'parsing_hint':
      return 'parsing';
    case 'filling':
      // Вторая и дальше попытки — это ретрай по фидбеку валидации.
      return gen.attempt > 1 ? 'retry' : 'filling';
    case 'done':
      return 'done';
    default:
      // Ошибка показывается строкой под панелью, сама панель снова готова.
      return 'idle';
  }
}

const BriefGenSection = ({ brief, gen }: BriefGenSectionProps) => {
  const [notes, setNotes] = useState('');
  const [verbosity, setVerbosity] = useState(VERBOSITY_DEFAULT);

  const gaps = useMemo(() => computeBriefGaps(brief), [brief]);
  const estimate = BRIEF_GEN_COST_EST.fill + (notes.trim() ? BRIEF_GEN_COST_EST.hintParse : 0);

  return (
    <>
      <BriefGenPanel
        phase={panelPhase(gen)}
        notes={notes}
        verbosity={verbosity}
        gaps={gaps.length}
        filled={gen.filled}
        attempt={`${gen.attempt}/3`}
        price={`≈ ${formatCost(estimate)}`}
        width="fill"
        generateDisabled={gaps.length === 0}
        onGenerate={() => void gen.generate(notes, verbosity)}
        onCancel={gen.cancel}
        onRollback={gen.undo}
        onNotesChange={setNotes}
        onVerbosityChange={v => setVerbosity(clampVerbosity(v))}
      />
      {gen.phase === 'error' && gen.error && <p className={styles.genError}>Не вышло: {gen.error}</p>}
      {gaps.length === 0 && gen.phase === 'idle' && (
        <p className={styles.footnote}>пустых полей нет — генератору здесь нечего делать</p>
      )}
    </>
  );
};

export default BriefGenSection;
