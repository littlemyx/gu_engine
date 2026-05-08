import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNarrativeStore, type StoryOutlinePlan } from '@/narrative';
import { AnchorNode } from './AnchorNode';
import { computeAnchorLayout, actColor } from './outlineLayout';
import styles from './OutlineGraph.module.css';
import playgroundStyles from './playground.module.css';

const nodeTypes: NodeTypes = {
  anchor: AnchorNode,
};

export type SelectedSegment = { fromId: string; toId: string };

const InnerGraph: React.FC<{
  outline: StoryOutlinePlan;
  onEdgeClick?: (s: SelectedSegment) => void;
  selected?: SelectedSegment | null;
}> = ({ outline, onEdgeClick, selected }) => {
  const { fitView } = useReactFlow();
  const narrationWebs = useNarrativeStore(s => s.narrationWebs);
  const images = useNarrativeStore(s => s.images);
  const { nodes: dagreNodes, edges } = useMemo(
    () => computeAnchorLayout(outline, narrationWebs, images),
    [outline, narrationWebs, images],
  );

  const [nodes, setNodes] = useState<Node[]>(dagreNodes);
  const anchorIdsKey = outline.anchors.map(a => a.id).join(',');
  const prevAnchorIdsRef = useRef(anchorIdsKey);
  const prevDagreRef = useRef(dagreNodes);
  useEffect(() => {
    if (anchorIdsKey !== prevAnchorIdsRef.current) {
      setNodes(dagreNodes);
      prevAnchorIdsRef.current = anchorIdsKey;
      prevDagreRef.current = dagreNodes;
    } else if (dagreNodes !== prevDagreRef.current) {
      prevDagreRef.current = dagreNodes;
      setNodes(prev => {
        const posMap = new Map(prev.map(n => [n.id, { position: n.position, measured: n.measured }]));
        return dagreNodes.map(n => {
          const saved = posMap.get(n.id);
          return saved ? { ...n, position: saved.position, measured: saved.measured } : n;
        });
      });
    }
  }, [anchorIdsKey, dagreNodes]);

  const onNodesChange: OnNodesChange = useCallback(changes => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);

  const handleAutoLayout = useCallback(() => {
    setNodes(prev => {
      const dagrePos = new Map(dagreNodes.map(n => [n.id, n.position]));
      return prev.map(n => ({ ...n, position: dagrePos.get(n.id) ?? n.position }));
    });
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [fitView, dagreNodes]);

  const styledEdges: Edge[] = useMemo(() => {
    if (!selected) return edges;
    return edges.map(e =>
      e.source === selected.fromId && e.target === selected.toId
        ? {
            ...e,
            animated: true,
            style: { ...(e.style ?? {}), strokeWidth: 3 },
          }
        : e,
    );
  }, [edges, selected]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={styledEdges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1.0 }}
      minZoom={0.2}
      maxZoom={1.5}
      onEdgeClick={(_, edge) => onEdgeClick?.({ fromId: edge.source, toId: edge.target })}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} color="#e5e7eb" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={n => (n.data as { actColor?: string })?.actColor ?? '#9ca3af'} />
      <Panel position="top-right">
        <button className={playgroundStyles.secondaryBtn} onClick={handleAutoLayout}>
          Автораскладка
        </button>
      </Panel>
    </ReactFlow>
  );
};

export const OutlineGraph: React.FC<{
  outline: StoryOutlinePlan;
  onEdgeClick?: (s: SelectedSegment) => void;
  selected?: SelectedSegment | null;
}> = ({ outline, onEdgeClick, selected }) => {
  const narrationWebs = useNarrativeStore(s => s.narrationWebs);
  const webCount = Object.keys(narrationWebs).length;

  return (
    <div className={styles.graphContainer}>
      <div className={styles.graphHeader}>
        <h2 className={styles.graphTitle}>{outline.title || 'Story Outline'}</h2>
        {outline.logline && <p className={styles.graphLogline}>{outline.logline}</p>}
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
          <InnerGraph outline={outline} onEdgeClick={onEdgeClick} selected={selected} />
        </ReactFlowProvider>
      </div>
      {onEdgeClick && (
        <div className={styles.graphHint}>Нажми на ребро между якорями, чтобы посмотреть narration web →</div>
      )}
      <div className={styles.graphLegend}>
        {(() => {
          const seen = new Set<number>();
          return outline.anchors
            .filter(a => !seen.has(a.act) && (seen.add(a.act), true))
            .sort((a, b) => a.act - b.act)
            .map(a => (
              <span key={a.act} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: actColor(a.act) }} />
                акт {a.act}
              </span>
            ));
        })()}
        <span className={styles.legendMeta}>
          {outline.anchors.length} якорей · {outline.anchorEdges.length} рёбер · {webCount} narration web
        </span>
      </div>
    </div>
  );
};
