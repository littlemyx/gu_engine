import { SceneGraph, SceneNode, SceneEdge } from "./types";

export class GameEngine {
  private graph: SceneGraph;
  private nodeMap: Map<string, SceneNode>;
  private edgesBySource: Map<string, SceneEdge[]>;
  private incomingCount: Map<string, number>;
  private currentNode: SceneNode | null = null;
  private onSceneChange: (node: SceneNode, isEnd: boolean) => void;

  constructor(
    graph: SceneGraph,
    onSceneChange: (node: SceneNode, isEnd: boolean) => void,
  ) {
    this.graph = graph;
    this.onSceneChange = onSceneChange;

    this.nodeMap = new Map();
    for (const node of graph.nodes) {
      this.nodeMap.set(node.id, node);
    }

    this.edgesBySource = new Map();
    this.incomingCount = new Map();

    for (const node of graph.nodes) {
      this.incomingCount.set(node.id, 0);
    }

    for (const edge of graph.edges) {
      const list = this.edgesBySource.get(edge.source) ?? [];
      list.push(edge);
      this.edgesBySource.set(edge.source, list);

      this.incomingCount.set(
        edge.target,
        (this.incomingCount.get(edge.target) ?? 0) + 1,
      );
    }
  }

  start(): void {
    const startNode = this.findStartNode();
    if (!startNode) {
      throw new Error("Не найдена стартовая сцена");
    }
    this.goTo(startNode.id);
  }

  choose(outputId: string): void {
    if (!this.currentNode) return;

    const edges = this.edgesBySource.get(this.currentNode.id) ?? [];
    const edge = edges.find((e) => e.sourceHandle === outputId);

    if (!edge) return;

    this.goTo(edge.target);
  }

  getCurrentNode(): SceneNode | null {
    return this.currentNode;
  }

  private goTo(nodeId: string): void {
    const node = this.nodeMap.get(nodeId);
    if (!node) return;

    this.currentNode = node;

    const hasConnectedOutputs = this.hasOutgoingEdges(node);
    this.onSceneChange(node, !hasConnectedOutputs);
  }

  private hasOutgoingEdges(node: SceneNode): boolean {
    const edges = this.edgesBySource.get(node.id) ?? [];
    return edges.length > 0;
  }

  private findStartNode(): SceneNode | null {
    // Стартовая сцена — та, в которую не ведёт ни одно ребро
    for (const node of this.graph.nodes) {
      if ((this.incomingCount.get(node.id) ?? 0) === 0) {
        return node;
      }
    }
    // Fallback: первый узел
    return this.graph.nodes[0] ?? null;
  }

  getConnectedOutputIds(): Set<string> {
    if (!this.currentNode) return new Set();
    const edges = this.edgesBySource.get(this.currentNode.id) ?? [];
    return new Set(edges.map((e) => e.sourceHandle));
  }
}
