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
import { getAllSegmentValidations, useBriefStore, useNarrativeStore, type OutlinePlan } from '@/narrative';
import { AnchorNode } from './AnchorNode';
import { computeAnchorLayout } from './outlineLayout';
import styles from './OutlineGraph.module.css';
import playgroundStyles from './playground.module.css';

const nodeTypes: NodeTypes = {
  anchor: AnchorNode,
};

export type SelectedSegment = { fromId: string; toId: string };

const InnerGraph: React.FC<{
  outline: OutlinePlan;
  onEdgeClick?: (s: SelectedSegment) => void;
  selected?: SelectedSegment | null;
  generatingEdgeIds?: Set<string>;
}> = ({ outline, onEdgeClick, selected, generatingEdgeIds }) => {
  const { fitView } = useReactFlow();
  const brief = useBriefStore(s => s.brief);
  const segments = useNarrativeStore(s => s.segments);
  const images = useNarrativeStore(s => s.images);
  const characters = useNarrativeStore(s => s.characters);
  const validations = useMemo(() => getAllSegmentValidations(brief, outline, segments), [brief, outline, segments]);
  const { nodes: dagreNodes, edges } = useMemo(
    () => computeAnchorLayout(outline, segments, validations, images, characters, generatingEdgeIds),
    [outline, segments, validations, images, characters, generatingEdgeIds],
  );

  // Рабочие ноды: dagre-раскладка + пользовательские изменения (drag, dimensions).
  // При смене структуры outline сбрасываем к dagre.
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
      // Data changed (images, validations, etc.) but structure is the same —
      // merge fresh data while keeping user positions and measured dims.
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

  // Подсветить выбранное ребро
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
      <MiniMap pannable zoomable nodeColor={n => (n.data as { routeColor?: string })?.routeColor ?? '#9ca3af'} />
      <Panel position="top-right">
        <button className={playgroundStyles.secondaryBtn} onClick={handleAutoLayout}>
          Автораскладка
        </button>
      </Panel>
    </ReactFlow>
  );
};

export const OutlineGraph: React.FC<{
  outline: OutlinePlan;
  onEdgeClick?: (s: SelectedSegment) => void;
  selected?: SelectedSegment | null;
  generatingEdgeIds?: Set<string>;
}> = ({ outline, onEdgeClick, selected, generatingEdgeIds }) => {
  const brief = useBriefStore(s => s.brief);
  const segments = useNarrativeStore(s => s.segments);
  const validations = useMemo(() => getAllSegmentValidations(brief, outline, segments), [brief, outline, segments]);
  const validationCounts = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    for (const issues of Object.values(validations)) {
      if (issues.some(it => it.severity === 'error')) errors++;
      else if (issues.some(it => it.severity === 'warning')) warnings++;
    }
    return { errors, warnings };
  }, [validations]);

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
          <InnerGraph
            outline={outline}
            onEdgeClick={onEdgeClick}
            selected={selected}
            generatingEdgeIds={generatingEdgeIds}
          />
        </ReactFlowProvider>
      </div>
      {onEdgeClick && (
        <div className={styles.graphHint}>Нажми на ребро между якорями, чтобы открыть генератор сцен сегмента →</div>
      )}
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
        {(validationCounts.errors > 0 || validationCounts.warnings > 0) && (
          <span className={styles.legendItem} style={{ color: validationCounts.errors > 0 ? '#dc2626' : '#d97706' }}>
            {validationCounts.errors > 0 && <>✗ {validationCounts.errors} невалидных</>}
            {validationCounts.errors > 0 && validationCounts.warnings > 0 && ' · '}
            {validationCounts.warnings > 0 && <>⚠ {validationCounts.warnings} с warning</>}
          </span>
        )}
        <span className={styles.legendMeta}>
          {outline.anchors.length} якорей · {outline.anchorEdges.length} рёбер
        </span>
      </div>
    </div>
  );
};
