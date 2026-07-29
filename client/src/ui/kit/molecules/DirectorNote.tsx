import React from 'react';

import DashedFrame from '../atoms/DashedFrame';
import TextLabel from '../atoms/TextLabel';

import styles from './DirectorNote.module.css';

export type DirectorNoteKind = 'quote' | 'add';

export interface DirectorNoteProps {
  /** `quote` — реплика режиссёра в кавычках; `add` — приглашение добавить свою. */
  kind?: DirectorNoteKind;
  text: string;
  /** Куда уйдёт правка; показывается только в режиме `quote`, стрелкой после текста. */
  hint?: string;
  onDark?: boolean;
  /** Ширина блока в px; в макете диапазон 200–460, по умолчанию 300. */
  width?: number;
}

/**
 * Порт `design_ref/components/DirectorNote.dc.html` (molecules.json#k017,
 * «ЗАМЕТКА РЕЖИССЁРУ»). Пунктирная реплика режиссёра поверх кадра: цитата в
 * кавычках с необязательной подсказкой, куда она уйдёт, либо приглашение
 * добавить собственную заметку. Собрана из `DashedFrame` (виды `note`/`add`)
 * и `TextLabel`; собственная разметка нужна только для ширины и внутреннего
 * отступа 4×8, которых нет в пропсах атома-рамки, и для приглушения подсказки,
 * которого нет у `TextLabel`.
 */
const DirectorNote = ({ kind = 'quote', text, hint, onDark = false, width = 300 }: DirectorNoteProps) => {
  const isAdd = kind === 'add';

  return (
    <DashedFrame kind={isAdd ? 'add' : 'note'} onDark={onDark} padding={0} interactive={false}>
      <div className={styles.body} style={{ width: `${width}px` }}>
        {isAdd ? (
          <TextLabel text={text} onDark={onDark} size={10.5} />
        ) : (
          <>
            <TextLabel text={`«${text}»`} onDark={onDark} size={10.5} />
            {hint && (
              <span className={styles.hint}>
                <TextLabel text={` → ${hint}`} onDark={onDark} size={10.5} />
              </span>
            )}
          </>
        )}
      </div>
    </DashedFrame>
  );
};

export default DirectorNote;
