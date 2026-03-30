import { useEffect, useRef } from 'react';
import styles from '../main.module.css';

export const NewProjectDialog = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onCancel}>
      <form method="dialog" className={styles.dialogContent}>
        <p className={styles.dialogText}>Создать новый проект? Текущий прототип будет очищен.</p>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.toolButton} onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className={`${styles.toolButton} ${styles.danger}`} onClick={onConfirm}>
            Создать
          </button>
        </div>
      </form>
    </dialog>
  );
};
