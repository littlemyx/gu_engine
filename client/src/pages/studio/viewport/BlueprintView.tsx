import React, { useMemo } from 'react';
import { Background, BackgroundVariant, Controls, MarkerType, ReactFlow } from '@xyflow/react';

import { useStudioStore } from '../studioStore';

import BeatNode from './BeatNode';

import '@xyflow/react/dist/style.css';
import styles from './viewport.module.css';

import type { Edge } from '@xyflow/react';
import type { BlueprintModel } from '../derive/blueprintModel';
import type { BeatFlowNode } from './BeatNode';

export interface BlueprintViewProps {
  model: BlueprintModel;
}

// Раскладка считается детерминированно: колонка — слот, дорожка — ветка.
// React Flow отвечает за камеру и рёбра, но не за то, где стоят биты.
const CARD_WIDTH = 168;
const CARD_HEIGHT = 88;
const COL_GAP = 54;
const ROW_GAP = 16;
const LANE_GAP = 40;
const PAD = 28;

const nodeTypes = { beat: BeatNode };

/** Чертёж хребта: карточки битов по слотам, связи — рёбра React Flow. */
const BlueprintView = ({ model }: BlueprintViewProps) => {
  const selection = useStudioStore(s => s.selection);
  const select = useStudioStore(s => s.select);

  const selectedId = selection?.kind === 'beat' ? selection.id : null;

  const nodes = useMemo<BeatFlowNode[]>(() => {
    // Высота дорожки — по самой плотной её ячейке, иначе стопка битов одного
    // слота наезжает на соседнюю ветку.
    const stackOfCell = new Map<string, number>();
    for (const node of model.nodes) {
      const cell = `${node.column}:${node.lane}`;
      stackOfCell.set(cell, (stackOfCell.get(cell) ?? 0) + 1);
    }
    const maxStackOfLane = new Map<number, number>();
    for (const [cell, count] of stackOfCell) {
      const lane = Number(cell.split(':')[1]);
      maxStackOfLane.set(lane, Math.max(maxStackOfLane.get(lane) ?? 1, count));
    }
    const laneTop = new Map<number, number>();
    let cursor = PAD;
    for (const lane of [...maxStackOfLane.keys()].sort((a, b) => a - b)) {
      laneTop.set(lane, cursor);
      cursor += (maxStackOfLane.get(lane) ?? 1) * (CARD_HEIGHT + ROW_GAP) + LANE_GAP;
    }

    const usedCells = new Map<string, number>();
    return model.nodes.map(node => {
      const cell = `${node.column}:${node.lane}`;
      const stack = usedCells.get(cell) ?? 0;
      usedCells.set(cell, stack + 1);

      return {
        id: node.id,
        type: 'beat' as const,
        position: {
          x: PAD + node.column * (CARD_WIDTH + COL_GAP),
          y: (laneTop.get(node.lane) ?? PAD) + stack * (CARD_HEIGHT + ROW_GAP),
        },
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        data: {
          kicker: node.kicker,
          title: node.title,
          state: node.state,
          dimmed: node.dimmed,
          selected: node.id === selectedId,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
        },
        draggable: false,
        connectable: false,
        selectable: true,
      };
    });
  }, [model, selectedId]);

  const edges = useMemo<Edge[]>(
    () =>
      model.edges.map(edge => ({
        id: `${edge.from}-${edge.to}-${edge.branch ? 'b' : 's'}`,
        source: edge.from,
        target: edge.to,
        type: 'smoothstep',
        label: edge.branch ? edge.label : undefined,
        animated: false,
        // Ветка — пунктиром: это переход по исходу развилки, а не порядок хребта.
        className: edge.branch ? styles.edgeBranchFlow : styles.edgeMainFlow,
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      })),
    [model],
  );

  return (
    <div className={styles.blueprintRoot}>
      <div className={styles.viewportBar}>
        <span className={styles.viewportMeta}>
          битов {model.nodes.length} · связей {model.edges.length}
        </span>
        <span>колонка — слот календаря · дорожка — ветка</span>
      </div>

      <div className={styles.blueprintFlow}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.8}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_event, node) => select({ kind: 'beat', id: node.id })}
          onPaneClick={() => select(null)}
        >
          <Background variant={BackgroundVariant.Lines} gap={20} className={styles.flowGrid} />
          <Controls showInteractive={false} className={styles.flowControls} />
        </ReactFlow>
      </div>
    </div>
  );
};

export default BlueprintView;
