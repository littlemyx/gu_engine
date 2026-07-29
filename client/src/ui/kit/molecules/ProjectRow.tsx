import React, { useState } from 'react';

import Frame from '../atoms/Frame';
import MutedText from '../atoms/MutedText';
import OutlineButton from '../atoms/OutlineButton';
import TextLabel from '../atoms/TextLabel';

import styles from './ProjectRow.module.css';

/** Состояние строки при первом рендере: обычная или сразу с открытым
 * подтверждением удаления. После монтирования строка переключает себя сама
 * кликами по «удалить»/«отмена» — так же, как это делает исходный DC-компонент
 * (`this.state.confirming ?? production props.state`). */
export type ProjectRowState = 'обычная' | 'подтверждение удаления';

export interface ProjectRowProps {
  /** Название проекта. */
  name: string;
  /** Служебная строка под названием, напр. «изменён 12 минут назад». */
  meta: string;
  /** Проект без названия: имя красится приглушённым тоном. */
  unnamed?: boolean;
  /** Начальное состояние строки. Дальше строка сама переключает confirm/cancel. */
  state?: ProjectRowState;
  /** Ширина строки, px (280–560 в макете). */
  width?: number;
  /** Открыть проект. Без колбэка кнопка «Открыть» не рендерится кликабельной. */
  onOpen?: () => void;
  /** Подтверждено удаление. Строка сама закрывает панель подтверждения. */
  onDelete?: () => void;
}

/**
 * Порт `design_ref/components/ProjectRow.dc.html` (molecules.json#p028,
 * «СТРОКА ПРОЕКТА ПИКЕРА»).
 * Строка проекта в списке пикера: имя + мета слева, «Открыть» и «удалить»
 * справа. Клик по «удалить» переключает строку на панель подтверждения
 * (сигнальные тона fail) с «удалить»/«отмена»; панель и текстовые
 * кнопки-триггеры собраны локально поверх токенов сигнала — у `Frame` нет
 * тона 'error'/'fail' (граница + фон сигнала одновременно), см. missingAtoms.
 */
const ProjectRow = ({
  name,
  meta,
  unnamed = false,
  state = 'обычная',
  width = 400,
  onOpen,
  onDelete,
}: ProjectRowProps) => {
  const [confirming, setConfirming] = useState(() => state === 'подтверждение удаления');

  const askDelete = () => setConfirming(true);
  const cancel = () => setConfirming(false);
  const confirm = () => {
    setConfirming(false);
    onDelete?.();
  };

  if (confirming) {
    return (
      <div className={styles.root} style={{ width: `${width}px` }}>
        <div className={styles.confirmPanel}>
          <div className={styles.confirmText}>
            <TextLabel text={name} bold tone="error" size={10.5} />
            <TextLabel text=" — удалить без возврата?" tone="error" size={10.5} />
          </div>
          <OutlineButton label="удалить" tone="danger" size="compact" onClick={confirm} />
          <button type="button" className={styles.cancelButton} onClick={cancel}>
            отмена
          </button>
        </div>
      </div>
    );
  }

  const nameClassName = [styles.name, unnamed ? styles.nameMuted : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <Frame tone="light" fill="paper" block paddingX={12} paddingY={9}>
        <div className={styles.row}>
          <div className={styles.info}>
            <div className={nameClassName}>{name}</div>
            <MutedText text={meta} size={10} />
          </div>
          <OutlineButton label="Открыть" tone="accent" size="compact" onClick={onOpen} />
          <button type="button" className={styles.deleteTrigger} onClick={askDelete}>
            удалить
          </button>
        </div>
      </Frame>
    </div>
  );
};

export default ProjectRow;
