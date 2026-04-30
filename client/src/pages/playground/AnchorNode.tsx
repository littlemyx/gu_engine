import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { AnchorNodeData } from './outlineLayout';
import styles from './AnchorNode.module.css';

const ANCHOR_TYPE_LABEL: Record<string, string> = {
  setup: 'setup',
  li_introduction: 'introduction',
  common_climax: 'common climax',
  route_opening: 'route opening',
  obstacle_reveal: 'obstacle',
  crisis: 'crisis',
  ending: 'ending',
};

export const AnchorNode = ({ data }: NodeProps<Node<AnchorNodeData>>) => {
  const entryReq = data.entryStateRequired;
  const flagsReq = entryReq?.flagsRequired ?? [];
  const rangesReq = entryReq?.ranges ?? {};
  const hasEntryReq = flagsReq.length > 0 || Object.keys(rangesReq).length > 0;

  return (
    <div className={styles.anchor} style={{ borderColor: data.routeColor }}>
      <Handle type="target" position={Position.Left} className={styles.handle} />

      {(data.imageUrl || data.spriteUrl) && (
        <div className={styles.thumbStrip}>
          {data.imageUrl && <img className={styles.thumbBg} src={data.imageUrl} alt="" title="background" />}
          {data.spriteUrl && (
            <img className={styles.thumbSprite} src={data.spriteUrl} alt="" title={data.characterFocus ?? 'sprite'} />
          )}
        </div>
      )}

      <div className={styles.header}>
        <span className={styles.typeBadge} style={{ background: data.routeColor }}>
          {ANCHOR_TYPE_LABEL[data.type] ?? data.type}
        </span>
        <span className={styles.actBadge}>акт {data.act}</span>
      </div>

      <div className={styles.id}>{data.id}</div>

      {data.characterFocus && <div className={styles.focus}>{data.characterFocus}</div>}

      <div className={styles.summary}>{data.summary}</div>

      {hasEntryReq && (
        <div className={styles.entryReqRow}>
          {flagsReq.map(f => (
            <span key={f} className={styles.entryReq} title="требуется флаг">
              ⚑ {f}
            </span>
          ))}
          {Object.entries(rangesReq).map(([path, range]) => (
            <span key={path} className={styles.entryReq} title="state-range">
              {path.replace('relationship[', '').replace(']', '')} ∈ [{range[0]}, {range[1]}]
            </span>
          ))}
        </div>
      )}

      {data.establishes.length > 0 && (
        <div className={styles.establishesRow}>
          {data.establishes.slice(0, 3).map(f => (
            <span key={f} className={styles.establish}>
              +{f}
            </span>
          ))}
          {data.establishes.length > 3 && <span className={styles.establish}>+{data.establishes.length - 3}</span>}
        </div>
      )}

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
};
