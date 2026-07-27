import React, { useState } from 'react';

import ActionButton from '@/ui/ActionButton';

import Modal from './Modal';

import styles from './modals.module.css';

import type { PrefabKind } from '@/prefabs/prefabTypes';

export interface SavePrefabModalProps {
  kind: PrefabKind;
  /** Имя по умолчанию: «Кира v3». */
  defaultName: string;
  /** Что войдёт в префаб — строки состава, посчитанные по проекту. */
  parts: Array<{ label: string; included: boolean; reason?: string }>;
  onSave: (name: string) => void;
  onClose: () => void;
}

const TITLE: Record<PrefabKind, string> = {
  character: 'Сохранить персонажа как префаб',
  world: 'Сохранить мир как префаб',
  audio_set: 'Сохранить аудио-набор как префаб',
};

/** Диалог «в библиотеку»: имя + состав того, что уедет вместе с префабом. */
const SavePrefabModal = ({ kind, defaultName, parts, onSave, onClose }: SavePrefabModalProps) => {
  const [name, setName] = useState(defaultName);

  return (
    <Modal
      title={TITLE[kind]}
      onClose={onClose}
      footer={
        <>
          <ActionButton onLight label="Отмена" kind="ghost" onClick={onClose} />
          <ActionButton
            onLight
            label="В библиотеку"
            disabled={name.trim().length === 0}
            reason="нужно имя"
            onClick={() => onSave(name.trim())}
          />
        </>
      }
    >
      <label className={styles.field}>
        <span className={styles.label}>Имя</span>
        <input
          className={styles.input}
          value={name}
          onChange={event => setName(event.target.value)}
          spellCheck={false}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Состав</span>
        {parts.map(part =>
          part.included ? (
            <div key={part.label} className={styles.checkbox}>
              <span>✓</span>
              {part.label}
            </div>
          ) : (
            <div key={part.label} className={styles.checkboxOff}>
              {part.label}
              {part.reason ? ` — ${part.reason}` : ''}
            </div>
          ),
        )}
      </div>

      <div className={styles.note}>Префаб переживёт эту историю: библиотека хранится отдельно от проекта.</div>
    </Modal>
  );
};

export default SavePrefabModal;
