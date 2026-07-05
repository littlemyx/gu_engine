export type Point = { x: number; y: number };
export type LayoutEdge = [string, string];

/**
 * Детерминированная раскладка небольшого графа локаций (3–10 узлов) без
 * внешних зависимостей и без Math.random. BFS-порядок для стабильной
 * инициализации по кругу, затем фиксированное число итераций силовой
 * релаксации (Fruchterman–Reingold-подобной), после — вписывание в бокс.
 *
 * Результат воспроизводим при одинаковых входах — важно, чтобы карта не
 * «прыгала» между открытиями.
 */
export function layoutMap(
  ids: string[],
  edges: LayoutEdge[],
  width: number,
  height: number,
  pad = 44,
): Map<string, Point> {
  const n = ids.length;
  if (n === 0) return new Map();
  if (n === 1) {
    return new Map([[ids[0], { x: width / 2, y: height / 2 }]]);
  }

  const idSet = new Set(ids);
  const cleanEdges = edges.filter(([a, b]) => idSet.has(a) && idSet.has(b) && a !== b);
  const order = bfsOrder(ids, cleanEdges);

  // Инициализация по кругу (радиус 1), угол от вертикали вверх.
  const pos = new Map<string, Point>();
  for (let i = 0; i < order.length; i++) {
    const a = (2 * Math.PI * i) / order.length - Math.PI / 2;
    pos.set(order[i], { x: Math.cos(a), y: Math.sin(a) });
  }

  const k = 1.6 / Math.sqrt(n); // идеальная длина ребра
  const ITER = 200;
  for (let it = 0; it < ITER; it++) {
    const temp = 0.1 * (1 - it / ITER); // охлаждение
    const disp = new Map<string, Point>(order.map((id) => [id, { x: 0, y: 0 }]));

    // Отталкивание всех пар.
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const a = order[i];
        const b = order[j];
        const pa = pos.get(a)!;
        const pb = pos.get(b)!;
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        let dist = Math.hypot(dx, dy) || 0.01;
        const rep = (k * k) / dist;
        dx = (dx / dist) * rep;
        dy = (dy / dist) * rep;
        const da = disp.get(a)!;
        const db = disp.get(b)!;
        da.x += dx;
        da.y += dy;
        db.x -= dx;
        db.y -= dy;
      }
    }

    // Притяжение по рёбрам.
    for (const [a, b] of cleanEdges) {
      const pa = pos.get(a)!;
      const pb = pos.get(b)!;
      let dx = pa.x - pb.x;
      let dy = pa.y - pb.y;
      let dist = Math.hypot(dx, dy) || 0.01;
      const att = (dist * dist) / k;
      dx = (dx / dist) * att;
      dy = (dy / dist) * att;
      const da = disp.get(a)!;
      const db = disp.get(b)!;
      da.x -= dx;
      da.y -= dy;
      db.x += dx;
      db.y += dy;
    }

    // Смещение с ограничением по температуре.
    for (const id of order) {
      const d = disp.get(id)!;
      const len = Math.hypot(d.x, d.y) || 0.01;
      const p = pos.get(id)!;
      p.x += (d.x / len) * Math.min(len, temp);
      p.y += (d.y / len) * Math.min(len, temp);
    }
  }

  return fitToBox(pos, ids, width, height, pad);
}

function bfsOrder(ids: string[], edges: LayoutEdge[]): string[] {
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of edges) {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  const seen = new Set<string>();
  const order: string[] = [];
  for (const start of ids) {
    if (seen.has(start)) continue;
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      order.push(cur);
      for (const nb of adj.get(cur)!) {
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
  }
  return order;
}

function fitToBox(
  pos: Map<string, Point>,
  ids: string[],
  width: number,
  height: number,
  pad: number,
): Map<string, Point> {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  const out = new Map<string, Point>();
  for (const id of ids) {
    const p = pos.get(id)!;
    out.set(id, {
      x: pad + ((p.x - minX) / spanX) * innerW,
      y: pad + ((p.y - minY) / spanY) * innerH,
    });
  }
  return out;
}
