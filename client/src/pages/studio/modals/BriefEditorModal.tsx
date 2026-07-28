import React from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import { validateBrief } from '@/narrative/validateBrief';
import { BriefEditor } from '@/pages/playground/BriefEditor';
import ActionButton from '@/ui/ActionButton';
import { pluralize } from '@/ui/plural';

import BriefGeneratePanel from './BriefGeneratePanel';
import Modal from './Modal';

import styles from './modals.module.css';

export interface BriefEditorModalProps {
  /** История уже сгенерирована: правки брифа её обесценят. */
  hasStory: boolean;
  onClose: () => void;
}

/**
 * Полная форма брифа — тот самый BriefEditor, «дорожка "С нуля"» из плана.
 * Компонент переиспользуется из legacy-плейграунда как есть: обе страницы
 * пишут в один briefStore, поэтому форме всё равно, откуда её открыли.
 */
const BriefEditorModal = ({ hasStory, onClose }: BriefEditorModalProps) => {
  const brief = useBriefStore(s => s.brief);
  const [generating, setGenerating] = React.useState(false);

  const errors = (() => {
    // validateBrief ходит по вложенным полям без проверок — на полупустом
    // брифе (сброшенном в «Пусто») он не должен ронять модалку.
    try {
      return validateBrief(brief).filter(i => i.severity === 'error');
    } catch {
      return [{ severity: 'error' as const, scope: 'brief', message: 'бриф заполнен не до конца' }];
    }
  })();

  return (
    <Modal
      title="Бриф истории"
      subtitle="Жанр, тон, длительность, каст. Из этого конвейер соберёт мир, календарь и хребет."
      editor
      onClose={onClose}
      footer={
        <>
          <span className={styles.footerStatus}>
            {errors.length === 0
              ? `бриф готов · ${pluralize(brief.loveInterests.length, 'персонаж', 'персонажа', 'персонажей')}`
              : `${pluralize(errors.length, 'проблема', 'проблемы', 'проблем')}: ${errors[0].message}`}
          </span>
          <ActionButton onLight label="Готово" onClick={onClose} />
        </>
      }
    >
      {hasStory && (
        <div className={styles.warning}>
          История уже сгенерирована: правки брифа её обесценят — понадобится перегенерация.
        </div>
      )}
      <BriefGeneratePanel onRunningChange={setGenerating} />
      <div className={generating ? styles.genBusyForm : undefined}>
        <BriefEditor brief={brief} />
      </div>
    </Modal>
  );
};

export default BriefEditorModal;
