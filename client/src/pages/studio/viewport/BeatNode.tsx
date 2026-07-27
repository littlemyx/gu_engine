import React from 'react';
import { Handle, Position } from '@xyflow/react';

import BeatCard from '@/ui/BeatCard';

import styles from './viewport.module.css';

import type { NodeProps, Node } from '@xyflow/react';
import type { BeatCardState } from '@/ui/BeatCard';

export type BeatNodeData = {
  kicker: string;
  title: string;
  state: BeatCardState;
  dimmed: boolean;
  selected: boolean;
  width: number;
  height: number;
};

export type BeatFlowNode = Node<BeatNodeData, 'beat'>;

/**
 * Узел «Чертежа» для React Flow: та же карточка BeatCard, что и в галерее
 * атомов, плюс невидимые ручки — рёбра цепляются к ним, а не к геометрии,
 * посчитанной на глаз.
 */
const BeatNode = ({ data }: NodeProps<BeatFlowNode>) => (
  <>
    <Handle type="target" position={Position.Left} className={styles.beatHandle} />
    <BeatCard
      kicker={data.kicker}
      title={data.title}
      state={data.state}
      dimmed={data.dimmed}
      selected={data.selected}
      width={data.width}
      height={data.height}
    />
    <Handle type="source" position={Position.Right} className={styles.beatHandle} />
  </>
);

export default BeatNode;
