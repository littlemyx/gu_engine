import React from 'react';

import { isSameSelection, useStudioStore } from '../studioStore';

import styles from './viewport.module.css';

import type { WorldMapModel } from '../derive/worldMapModel';
import { WORLD_NODE_HEIGHT, WORLD_NODE_WIDTH } from '../derive/worldMapModel';

export interface WorldMapViewProps {
  model: WorldMapModel;
}

/** «Карта мира»: локации и разрешённые переходы. Правки — через инспектор. */
const WorldMapView = ({ model }: WorldMapViewProps) => {
  const selection = useStudioStore(s => s.selection);
  const select = useStudioStore(s => s.select);

  const selectedId = selection?.kind === 'location' ? selection.id : null;

  return (
    <div className={styles.mapRoot}>
      <div className={styles.viewportBar}>
        <span className={styles.viewportMeta}>
          {model.nodes.length} локаций · {model.edges.length} переходов
        </span>
        <span>штриховая рамка — локация без переходов</span>
      </div>

      <div className={styles.mapScroll}>
        <div className={styles.mapCanvas} style={{ width: model.width, height: model.height }}>
          <svg className={styles.mapEdges} width={model.width} height={model.height}>
            {model.edges.map(edge => {
              const active = selectedId === edge.from || selectedId === edge.to;
              return (
                <g key={`${edge.from}|${edge.to}`}>
                  <line
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    className={active ? styles.mapEdgeActive : styles.mapEdge}
                  />
                  {active && edge.via && (
                    <text
                      x={(edge.x1 + edge.x2) / 2}
                      y={(edge.y1 + edge.y2) / 2 - 4}
                      className={styles.mapEdgeLabel}
                      textAnchor="middle"
                    >
                      {edge.via}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {model.nodes.map(node => (
            <button
              key={node.id}
              type="button"
              className={`${styles.mapNode} ${
                isSameSelection(selection, { kind: 'location', id: node.id }) ? styles.mapNodeSelected : ''
              } ${node.state === 'unreachable' ? styles.mapNodeUnreachable : ''}`}
              style={{
                left: node.x,
                top: node.y,
                width: WORLD_NODE_WIDTH,
                minHeight: WORLD_NODE_HEIGHT,
              }}
              onClick={() => select({ kind: 'location', id: node.id })}
              title={node.name}
            >
              {/* Полное имя в две строки: обрезка по 14 символам давала
                  «парк рядом с .» — узел шире, чем короткий код. */}
              <span className={styles.mapNodeTitle}>{node.name}</span>
              <span className={styles.mapNodeMeta}>
                {node.ambientLabel ? `♪ ${node.ambientLabel} · ` : ''}
                фон {node.hasBackground ? '✓' : '—'} · сцен {node.beatCount + node.unitCount}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorldMapView;
