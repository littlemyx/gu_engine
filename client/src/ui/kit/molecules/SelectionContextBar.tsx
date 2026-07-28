import React from 'react';

import BreadcrumbPath from '../atoms/BreadcrumbPath';
import OutlineButton from '../atoms/OutlineButton';
import TextLabel from '../atoms/TextLabel';

import styles from './SelectionContextBar.module.css';

export interface SelectionContextBarProps {
  /** Слово перед путём, напр. «Выбрано:». */
  prefix?: string;
  /** Путь до выбранной сцены, сегменты через «›» (напр. «Акт II › слот Д5в › Б5 «Ссора»»). */
  path: string;
  /** Необязательная служебная строка после пути (напр. пометка о состоянии кадра). */
  note?: string;
  /** Подпись кнопки запуска проигрывания с этой точки. */
  playLabel: string;
  /** Подпись кнопки повторной генерации (обычно несёт и ориентировочную цену). */
  retakeLabel: string;
  onPlay?: () => void;
  onRetake?: () => void;
}

/**
 * Порт `design_ref/components/SelectionContextBar.dc.html` (molecules.json#k012).
 * Контекст-бар выбора: где именно во вьюпорте стоит курсор (путь + необязательная
 * заметка) и пара быстрых действий над этой точкой — проиграть или пересгенерить.
 */
const SelectionContextBar = ({
  prefix = 'Выбрано:',
  path,
  note,
  playLabel,
  retakeLabel,
  onPlay,
  onRetake,
}: SelectionContextBarProps) => {
  return (
    <div className={styles.root}>
      <div className={styles.info}>
        <span className={styles.prefix}>
          <TextLabel text={prefix} bold size={10.5} />
        </span>
        <span className={styles.path}>
          <BreadcrumbPath path={path} size={10.5} />
        </span>
        {note && (
          <span className={styles.note}>
            <TextLabel text={note} size={10.5} />
          </span>
        )}
      </div>
      <span className={styles.actions}>
        <OutlineButton label={playLabel} tone="neutral" size="compact" onClick={onPlay} />
        <OutlineButton label={retakeLabel} tone="accent" size="compact" onClick={onRetake} />
      </span>
    </div>
  );
};

export default SelectionContextBar;
