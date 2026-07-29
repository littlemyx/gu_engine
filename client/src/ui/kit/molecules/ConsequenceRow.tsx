import React from 'react';

import PriceTag from '../atoms/PriceTag';
import TextLabel from '../atoms/TextLabel';

import styles from './ConsequenceRow.module.css';

export type ConsequenceRowGlyph = '◐' | '●' | '▣' | '✎';

export interface ConsequenceRowProps {
  /** Глиф последствия: ◐ протухнет, ● готово, ▣ артефакт, ✎ правка вручную. */
  glyph?: ConsequenceRowGlyph;
  /** Что случится, напр. «Проза — протухнут 44 юнита + 2 концовки». */
  text: string;
  /** Действие со сметой, напр. «довести ≈$5.10». */
  action: string;
  /** активная — тёмный текст и жирное действие; тихая — вся строка приглушена. */
  active?: boolean;
  /** Волосяная линия под строкой — разделитель между строками списка. */
  divider?: boolean;
}

/**
 * Порт `design_ref/components/ConsequenceRow.dc.html` (molecules.json#k108,
 * «СТРОКА ПОСЛЕДСТВИЙ · ◐ / ● / ▣ / ✎»).
 * Строка последствия решения в списке: глиф + описание слева, действие со
 * сметой справа. Атомы `StatusGlyph`, `Frame` и `Divider` из реестра не
 * подошли (см. `missingAtoms` в отчёте порта) — глиф и подпись собраны одним
 * `TextLabel`, а рамка и разделитель строки набраны локально теми же
 * токенами, что использует дизайн.
 */
const ConsequenceRow = ({ glyph = '◐', text, action, active = true, divider = true }: ConsequenceRowProps) => {
  const className = [styles.root, divider ? styles.divider : ''].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <span className={styles.body}>
        <TextLabel text={`${glyph} ${text}`} tone={active ? 'normal' : 'muted'} size={10.5} />
      </span>
      <span className={styles.action}>
        <PriceTag value={action} variant={active ? 'total' : 'standalone'} fontFamily="body" sizePx={10.5} />
      </span>
    </div>
  );
};

export default ConsequenceRow;
