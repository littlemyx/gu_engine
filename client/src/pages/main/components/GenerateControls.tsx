import type { GenerationState } from '../types';
import { GenerationStatus } from './GenerationStatus';
import styles from './GenerateControls.module.css';

export const GenerateControls = ({
  generation,
  onGenerate,
  disabled,
}: {
  generation?: GenerationState;
  onGenerate: () => void;
  disabled?: boolean;
}) => (
  <>
    {generation && <GenerationStatus generation={generation} />}
    <button
      type="button"
      className={`nodrag nopan ${styles.generateBtn}`}
      onClick={onGenerate}
      disabled={disabled || generation?.status === 'generating'}
    >
      {generation?.status === 'generating' ? 'Генерация…' : 'Сгенерировать'}
    </button>
  </>
);
