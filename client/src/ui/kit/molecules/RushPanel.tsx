import React from 'react';

import Cursor from '../atoms/Cursor';
import Frame from '../atoms/Frame';
import Kicker from '../atoms/Kicker';
import TextLabel from '../atoms/TextLabel';

import styles from './RushPanel.module.css';

export interface RushPanelProps {
  /** Кто говорит — печатается кикером капслоком над репликой. */
  speaker: string;
  /** Реплика черновика без кавычек — их добавляет панель. */
  text: string;
  /** Идёт ли стрим прямо сейчас: показывает мигающий курсор после реплики. */
  streaming?: boolean;
}

/**
 * Порт `design_ref/components/RushPanel.dc.html` (molecules.json#k055).
 * Панель раша: живой стрим черновика реплики персонажа в конвейере — спикер
 * кикером, текст реплики и мигающий курсор, пока генерация не завершилась.
 * У исходника нет пропа `context` — панель всегда живёт на тёмном хроме
 * конвейера, поэтому `onDark` здесь не нужен.
 */
const RushPanel = ({ speaker, text, streaming = true }: RushPanelProps) => {
  return (
    <Frame tone="dark" interactive={false} padding={0}>
      <div className={styles.body}>
        <Kicker text={speaker} tone="accent" onDark size={10} />
        <div className={styles.line}>
          <TextLabel text={`«${text}»`} onDark size={12} />
          {streaming && <Cursor tone="accent" onDark size={11} />}
        </div>
      </div>
    </Frame>
  );
};

export default RushPanel;
