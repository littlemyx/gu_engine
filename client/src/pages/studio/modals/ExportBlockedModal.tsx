import React, { useState } from 'react';

import ActionButton from '@/ui/ActionButton';

import Modal from './Modal';

import styles from './modals.module.css';

import type { SegmentIssue } from '@/narrative/types';

export interface ExportBlockedModalProps {
  errors: SegmentIssue[];
  warnings: number;
  /** QA ещё не запускался: экспорт не проверен, но и не заблокирован. */
  qaRan: boolean;
  /** Чего не хватает для сборки бандла вообще — это QA не лечится. */
  stackReason?: string;
  onExportAnyway: () => void;
  onOpenReport: () => void;
  onClose: () => void;
}

/**
 * Гейт экспорта. Ошибки QA — это сцены, которых в игре не будет; обойти гейт
 * можно, но только осознанно: чекбокс и отдельная кнопка.
 */
const ExportBlockedModal = ({
  errors,
  warnings,
  qaRan,
  stackReason,
  onExportAnyway,
  onOpenReport,
  onClose,
}: ExportBlockedModalProps) => {
  const [override, setOverride] = useState(false);
  const blockedByStack = Boolean(stackReason);

  return (
    <Modal
      title={blockedByStack ? 'Бандл не собрать' : 'Экспорт заблокирован'}
      onClose={onClose}
      footer={
        <>
          <ActionButton onLight label="Отчёт QA" kind="ghost" onClick={onOpenReport} />
          <ActionButton
            onLight
            label="Скачать всё равно"
            disabled={blockedByStack || !override}
            reason={blockedByStack ? stackReason : 'нужно подтвердить обход чекбоксом'}
            onClick={onExportAnyway}
          />
        </>
      }
    >
      {blockedByStack ? (
        <div className={styles.quote}>{stackReason}</div>
      ) : (
        <>
          <div>
            Story QA нашёл <b>{errors.length}</b> {errors.length === 1 ? 'ошибку' : 'ошибок'}
            {qaRan ? ':' : ' в прошлом отчёте:'}
          </div>
          <div className={styles.list}>
            {errors.slice(0, 6).map((issue, index) => (
              <div key={`${issue.scope}-${index}`} className={styles.quote}>
                ▨ <span className={styles.mono}>{issue.scope}</span> — {issue.message}
              </div>
            ))}
            {errors.length > 6 && <div className={styles.note}>…и ещё {errors.length - 6} — см. отчёт.</div>}
          </div>
          <div className={styles.note}>{warnings} предупреждений не блокируют экспорт — см. отчёт.</div>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} />
            экспортировать несмотря на ошибки
          </label>
        </>
      )}
    </Modal>
  );
};

export default ExportBlockedModal;
