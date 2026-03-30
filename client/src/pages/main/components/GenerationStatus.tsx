import type { FailedItem } from '@root/image_gen/generated_client';
import type { GenerationState } from '../types';
import styles from './GenerationStatus.module.css';

const GenerationErrors = ({ errors }: { errors: FailedItem[] }) => (
  <div className={styles.generationErrors}>
    {errors.map(e => (
      <div key={e.id} className={styles.generationErrorItem}>
        <span className={styles.generationErrorId}>{e.id}:</span>{' '}
        <span className={styles.generationErrorMsg}>{e.error ?? 'неизвестная ошибка'}</span>
      </div>
    ))}
  </div>
);

export const GenerationStatus = ({ generation }: { generation: GenerationState }) => {
  if (generation.status === 'generating') {
    const pct = generation.totalCount
      ? Math.round(((generation.completedCount ?? 0) / generation.totalCount) * 100)
      : 0;
    return (
      <div className={styles.generationStatus}>
        <div className={styles.loader} />
        <span className={styles.generationText}>Генерация… {pct}%</span>
        {generation.errors && <GenerationErrors errors={generation.errors} />}
      </div>
    );
  }
  if (generation.status === 'done') {
    return (
      <div className={styles.generationStatus}>
        <span className={styles.generationDone}>Готово</span>
        {generation.errors && <GenerationErrors errors={generation.errors} />}
      </div>
    );
  }
  if (generation.status === 'failed') {
    return (
      <div className={styles.generationStatus}>
        <span className={styles.generationFailed}>Ошибка</span>
        {generation.errors && <GenerationErrors errors={generation.errors} />}
      </div>
    );
  }
  return null;
};
