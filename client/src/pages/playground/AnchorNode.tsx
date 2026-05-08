import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { AnchorNodeData } from './outlineLayout';
import styles from './AnchorNode.module.css';

const ANCHOR_TYPE_LABEL: Record<string, string> = {
  setup: 'setup',
  location_enter: 'локация',
  story_beat: 'story beat',
  climax: 'кульминация',
  resolution: 'развязка',
};

export const AnchorNode = ({ data }: NodeProps<Node<AnchorNodeData>>) => {
  return (
    <div className={styles.anchor} style={{ borderColor: data.actColor }}>
      <Handle type="target" position={Position.Left} className={styles.handle} />

      {data.imageUrl && (
        <div className={styles.thumbStrip}>
          <img className={styles.thumbBg} src={data.imageUrl} alt="" title="background" />
        </div>
      )}

      <div className={styles.header}>
        <span className={styles.typeBadge} style={{ background: data.actColor }}>
          {ANCHOR_TYPE_LABEL[data.type] ?? data.type}
        </span>
        <span className={styles.actBadge}>акт {data.act}</span>
      </div>

      <div className={styles.id}>{data.id}</div>

      {data.location && <div className={styles.focus}>{data.location}</div>}
      {data.timeMarker && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{data.timeMarker}</div>}

      <div className={styles.summary}>{data.summary}</div>

      {data.availableLIs.length > 0 && (
        <div className={styles.establishesRow}>
          {data.availableLIs.map(li => (
            <span key={li} className={styles.establish} title="доступный LI">
              {li}
            </span>
          ))}
        </div>
      )}

      {data.establishes.length > 0 && (
        <div className={styles.entryReqRow}>
          {data.establishes.slice(0, 3).map(f => (
            <span key={f} className={styles.entryReq}>
              +{f}
            </span>
          ))}
          {data.establishes.length > 3 && <span className={styles.entryReq}>+{data.establishes.length - 3}</span>}
        </div>
      )}

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
};
