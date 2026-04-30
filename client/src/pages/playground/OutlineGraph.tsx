import React, { useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { OutlinePlan } from '@/narrative';
import { AnchorNode } from './AnchorNode';
import { computeAnchorLayout } from './outlineLayout';
import styles from './OutlineGraph.module.css';

const nodeTypes: NodeTypes = {
  anchor: AnchorNode,
};

const InnerGraph: React.FC<{ outline: OutlinePlan }> = ({ outline }) => {
  const { nodes, edges } = useMemo(() => computeAnchorLayout(outline), [outline]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1.0 }}
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} color="#e5e7eb" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={n => (n.data as { routeColor?: string })?.routeColor ?? '#9ca3af'} />
    </ReactFlow>
  );
};

export const OutlineGraph: React.FC<{ outline: OutlinePlan }> = ({ outline }) => {
  return (
    <div className={styles.graphContainer}>
      <div className={styles.graphHeader}>
        <h2 className={styles.graphTitle}>{outline.title || 'Outline-граф'}</h2>
        {outline.logline && <p className={styles.graphLogline}>{outline.logline}</p>}
        {outline.centralConflict && (
          <p className={styles.graphConflict}>
            <strong>Центральный конфликт: </strong>
            {outline.centralConflict}
          </p>
        )}
        <div className={styles.actsStrip}>
          {outline.acts.map(a => (
            <div key={a.act} className={styles.actChip}>
              <span className={styles.actChipNum}>акт {a.act}</span>
              <span className={styles.actChipPurpose}>{a.purpose}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.graphCanvas}>
        <ReactFlowProvider>
          <InnerGraph outline={outline} />
        </ReactFlowProvider>
      </div>
      <div className={styles.graphLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#fbbf24' }} />
          common-route
        </span>
        {(() => {
          const seen = new Set<string>();
          return outline.anchors
            .filter(a => a.routeId !== 'common' && !seen.has(a.routeId) && (seen.add(a.routeId), true))
            .map((a, i) => {
              const palette = ['#8b5cf6', '#0ea5e9', '#ec4899', '#f97316', '#22c55e'];
              return (
                <span key={a.routeId} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: palette[i % palette.length] }} />
                  {a.routeId}
                </span>
              );
            });
        })()}
        <span className={styles.legendMeta}>
          {outline.anchors.length} якорей · {outline.anchorEdges.length} рёбер
        </span>
      </div>
    </div>
  );
};
