import React, { useState } from 'react';

import ActionButton from '@/ui/ActionButton';

import Modal from './Modal';

import styles from './modals.module.css';

export type NewProjectTemplate = 'blank' | 'sample';

export interface NewProjectModalProps {
  /** Есть ли в текущем проекте сгенерированная история, а не пустой бриф. */
  hasStory: boolean;
  /** «≈ $0.21» — во что обошлась текущая история; она остаётся на месте. */
  spent: string;
  onConfirm: (name: string, template: NewProjectTemplate) => void;
  onClose: () => void;
}

/**
 * «Новый проект» (макет 7f): имя + две дорожки — пустой бриф или образец
 * sample-brief.json, чтобы посмотреть весь путь, не заполняя бриф. Новый
 * проект заводится рядом со старым: у каждого свой неймспейс в хранилище.
 */
const NewProjectModal = ({ hasStory, spent, onConfirm, onClose }: NewProjectModalProps) => {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<NewProjectTemplate>('blank');

  return (
    <Modal
      title="Новый проект"
      subtitle="Откроется в этой вкладке; текущий проект останется в списке «Файл → Все проекты…»."
      onClose={onClose}
      footer={
        <>
          <ActionButton onLight label="Отмена" kind="ghost" onClick={onClose} />
          <ActionButton onLight label="Создать" onClick={() => onConfirm(name, template)} />
        </>
      }
    >
      <label className={styles.field}>
        <span className={styles.label}>Название</span>
        <input
          className={styles.input}
          value={name}
          placeholder="без названия"
          onChange={e => setName(e.target.value)}
        />
      </label>

      <div className={styles.templateOptions}>
        <label className={`${styles.templateOption} ${template === 'blank' ? styles.templateOptionActive : ''}`}>
          <input type="radio" name="new-project" checked={template === 'blank'} onChange={() => setTemplate('blank')} />
          <span>
            <span className={styles.templateTitle}>Пустой проект</span>
            <span className={styles.templateHint}>чистый бриф, генерация с нуля</span>
          </span>
        </label>
        <label className={`${styles.templateOption} ${template === 'sample' ? styles.templateOptionActive : ''}`}>
          <input
            type="radio"
            name="new-project"
            checked={template === 'sample'}
            onChange={() => setTemplate('sample')}
          />
          <span>
            <span className={styles.templateTitle}>Подставить образец</span>
            <span className={styles.templateHint}>
              sample-brief.json — университетская новелла: 3 LI, мир, темы. Посмотреть весь путь, не заполняя бриф
            </span>
          </span>
        </label>
      </div>

      {hasStory && (
        <div className={styles.warning}>
          Вкладка перезагрузится. Текущая история ({spent} генерации) останется в своём проекте; идущий прогон оборвётся
          — дожать его можно, вернувшись в проект.
        </div>
      )}
    </Modal>
  );
};

export default NewProjectModal;
