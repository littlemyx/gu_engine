import { ReactFlowProvider } from '@xyflow/react';
import { Flow } from './components/Flow';
import styles from './main.module.css';

// Re-export types for external consumers (e.g. store)
export type {
  SceneOutput,
  CharacterPose,
  GenerationState,
  CardType,
  SceneCharacter,
  CardNodeData,
  CardNode,
  CardEdge,
  ExportData,
} from './types';

const Main = () => {
  return (
    <div className={styles.container}>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
};

export default Main;
