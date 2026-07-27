import React, { useState } from 'react';

import ActionButton from '@/ui/ActionButton';

import Modal from './Modal';

import styles from './modals.module.css';

export interface ResetDraftModalProps {
  /** Что уже оплачено в черновике. */
  phase: string;
  completed: number;
  total: number;
  /** «≈ $0.21» — сколько стоило то, что будет выброшено. */
  spent: string;
  onConfirm: (archive: boolean) => void;
  onClose: () => void;
}

/**
 * Сброс черновика — разрушающее действие с ценой в деньгах: выброшенные
 * стадии придётся оплачивать заново. Поэтому модалка называет цифру, а копия
 * по умолчанию складывается в архив.
 */
const ResetDraftModal = ({ phase, completed, total, spent, onConfirm, onClose }: ResetDraftModalProps) => {
  const [archive, setArchive] = useState(true);

  return (
    <Modal
      title="Сбросить черновик?"
      onClose={onClose}
      footer={
        <>
          <ActionButton onLight label="Отмена" kind="ghost" onClick={onClose} />
          <ActionButton onLight label="Сбросить" onClick={() => onConfirm(archive)} />
        </>
      }
    >
      <div>
        Будет удалён незавершённый прогон: стадия <b className={styles.mono}>{phase}</b>, готово {completed} из {total}{' '}
        — <b>{spent} генерации</b>. Бриф, каст, готовая история и префабы останутся.
      </div>
      <label className={styles.checkbox}>
        <input type="checkbox" checked={archive} onChange={event => setArchive(event.target.checked)} />
        сохранить копию как архив (бесплатно)
      </label>
    </Modal>
  );
};

export default ResetDraftModal;
