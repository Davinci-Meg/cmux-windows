import type { LayoutNode, PaneNode } from "../types/split";

let paneCounter = 0;

export function generatePaneId(): string {
  paneCounter += 1;
  return `pane-${paneCounter}`;
}

export function findPaneByTabId(node: LayoutNode, tabId: string): PaneNode | null {
  if (node.type === "pane") {
    return node.tabId === tabId ? node : null;
  }
  for (const child of node.children) {
    const found = findPaneByTabId(child, tabId);
    if (found) return found;
  }
  return null;
}

export function findPaneById(node: LayoutNode, paneId: string): PaneNode | null {
  if (node.type === "pane") {
    return node.id === paneId ? node : null;
  }
  for (const child of node.children) {
    const found = findPaneById(child, paneId);
    if (found) return found;
  }
  return null;
}

export function splitPane(
  node: LayoutNode,
  paneId: string,
  direction: "horizontal" | "vertical",
  newTabId: string
): LayoutNode {
  if (node.type === "pane") {
    if (node.id === paneId) {
      const newPane: PaneNode = { type: "pane", id: generatePaneId(), tabId: newTabId };
      return {
        type: "split",
        id: `split-${Date.now()}`,
        direction,
        children: [node, newPane],
        sizes: [50, 50],
      };
    }
    return node;
  }

  const newChildren = node.children.map((child) => splitPane(child, paneId, direction, newTabId));
  if (newChildren.every((c, i) => c === node.children[i])) return node;
  return { ...node, children: newChildren };
}

export function closePane(node: LayoutNode, paneId: string): LayoutNode | null {
  if (node.type === "pane") {
    return node.id === paneId ? null : node;
  }

  const newChildren: LayoutNode[] = [];
  const newSizes: number[] = [];

  for (let i = 0; i < node.children.length; i++) {
    const result = closePane(node.children[i], paneId);
    if (result !== null) {
      newChildren.push(result);
      newSizes.push(node.sizes[i]);
    }
  }

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];

  const total = newSizes.reduce((a, b) => a + b, 0);
  const normalizedSizes = newSizes.map((s) => (s / total) * 100);

  return { ...node, children: newChildren, sizes: normalizedSizes };
}

export function updateSizes(node: LayoutNode, splitId: string, newSizes: number[]): LayoutNode {
  if (node.type === "pane") return node;
  if (node.id === splitId) return { ...node, sizes: newSizes };
  const newChildren = node.children.map((child) => updateSizes(child, splitId, newSizes));
  if (newChildren.every((c, i) => c === node.children[i])) return node;
  return { ...node, children: newChildren };
}

export function getAllPaneIds(node: LayoutNode): string[] {
  if (node.type === "pane") return [node.id];
  return node.children.flatMap(getAllPaneIds);
}

export function getAllTabIds(node: LayoutNode): string[] {
  if (node.type === "pane") return node.tabId ? [node.tabId] : [];
  return node.children.flatMap(getAllTabIds);
}

export function replacePaneTab(node: LayoutNode, paneId: string, newTabId: string): LayoutNode {
  if (node.type === "pane") {
    return node.id === paneId ? { ...node, tabId: newTabId } : node;
  }
  const newChildren = node.children.map((child) => replacePaneTab(child, paneId, newTabId));
  if (newChildren.every((c, i) => c === node.children[i])) return node;
  return { ...node, children: newChildren };
}

export function getNextPaneId(node: LayoutNode, currentPaneId: string): string | null {
  const paneIds = getAllPaneIds(node);
  const index = paneIds.indexOf(currentPaneId);
  if (index < 0) return paneIds[0] || null;
  return paneIds[(index + 1) % paneIds.length];
}

export function getPrevPaneId(node: LayoutNode, currentPaneId: string): string | null {
  const paneIds = getAllPaneIds(node);
  const index = paneIds.indexOf(currentPaneId);
  if (index < 0) return paneIds[0] || null;
  return paneIds[(index - 1 + paneIds.length) % paneIds.length];
}

export function getAllPanesFlat(node: LayoutNode): PaneNode[] {
  if (node.type === "pane") return [node];
  return node.children.flatMap(getAllPanesFlat);
}

export function splitPaneAt(
  node: LayoutNode,
  paneId: string,
  direction: "horizontal" | "vertical",
  newTabId: string,
  position: "before" | "after"
): LayoutNode {
  if (node.type === "pane") {
    if (node.id === paneId) {
      const newPane: PaneNode = { type: "pane", id: generatePaneId(), tabId: newTabId };
      const children = position === "before" ? [newPane, node] : [node, newPane];
      return {
        type: "split",
        id: `split-${Date.now()}`,
        direction,
        children,
        sizes: [50, 50],
      };
    }
    return node;
  }
  const newChildren = node.children.map((child) => splitPaneAt(child, paneId, direction, newTabId, position));
  if (newChildren.every((c, i) => c === node.children[i])) return node;
  return { ...node, children: newChildren };
}

// 指定方向に分割可能かチェック（最大2×2グリッド = 各方向depth 1まで）
export function canSplitInDirection(
  node: LayoutNode,
  paneId: string,
  direction: "horizontal" | "vertical"
): boolean {
  return checkSplitDepth(node, paneId, direction, 0, 0);
}

function checkSplitDepth(
  node: LayoutNode,
  paneId: string,
  direction: "horizontal" | "vertical",
  hDepth: number,
  vDepth: number
): boolean {
  if (node.type === "pane") {
    if (node.id !== paneId) return true;
    const newH = direction === "horizontal" ? hDepth + 1 : hDepth;
    const newV = direction === "vertical" ? vDepth + 1 : vDepth;
    return newH <= 1 && newV <= 1;
  }
  const newH = node.direction === "horizontal" ? hDepth + 1 : hDepth;
  const newV = node.direction === "vertical" ? vDepth + 1 : vDepth;
  for (const child of node.children) {
    if (!checkSplitDepth(child, paneId, direction, newH, newV)) return false;
  }
  return true;
}

export function removePanesWithTabId(node: LayoutNode, tabId: string): LayoutNode | null {
  if (node.type === "pane") {
    return node.tabId === tabId ? null : node;
  }

  const newChildren: LayoutNode[] = [];
  const newSizes: number[] = [];

  for (let i = 0; i < node.children.length; i++) {
    const result = removePanesWithTabId(node.children[i], tabId);
    if (result !== null) {
      newChildren.push(result);
      newSizes.push(node.sizes[i]);
    }
  }

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];

  const total = newSizes.reduce((a, b) => a + b, 0);
  const normalizedSizes = newSizes.map((s) => (s / total) * 100);

  return { ...node, children: newChildren, sizes: normalizedSizes };
}
