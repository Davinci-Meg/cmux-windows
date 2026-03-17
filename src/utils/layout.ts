import type { LayoutNode, PaneNode } from "../types/split";

let paneCounter = 0;

export function generatePaneId(): string {
  paneCounter += 1;
  return `pane-${paneCounter}`;
}

export function resetPaneCounter(value = 0): void {
  paneCounter = value;
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

  // サイズを正規化して合計100にする
  const total = newSizes.reduce((a, b) => a + b, 0);
  const normalizedSizes = newSizes.map((s) => (s / total) * 100);

  return { ...node, children: newChildren, sizes: normalizedSizes };
}

export function updateSizes(node: LayoutNode, splitId: string, newSizes: number[]): LayoutNode {
  if (node.type === "pane") return node;
  if (node.id === splitId) {
    return { ...node, sizes: newSizes };
  }
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

// ペインのタブを差し替え（IDはそのまま、Terminal再マウントなし）
export function replacePaneTab(node: LayoutNode, paneId: string, newTabId: string): LayoutNode {
  if (node.type === "pane") {
    return node.id === paneId ? { ...node, tabId: newTabId } : node;
  }
  const newChildren = node.children.map((child) => replacePaneTab(child, paneId, newTabId));
  if (newChildren.every((c, i) => c === node.children[i])) return node;
  return { ...node, children: newChildren };
}

// ペインを新しいID付きで置き換え（Terminal再マウントが必要な場合）
export function replacePaneWithNew(
  node: LayoutNode,
  paneId: string,
  newTabId: string
): { layout: LayoutNode; newPaneId: string } {
  const newPaneId = generatePaneId();
  const layout = replacePaneNode(node, paneId, { type: "pane", id: newPaneId, tabId: newTabId });
  return { layout, newPaneId };
}

function replacePaneNode(node: LayoutNode, paneId: string, newPane: PaneNode): LayoutNode {
  if (node.type === "pane") {
    return node.id === paneId ? newPane : node;
  }
  const newChildren = node.children.map((child) => replacePaneNode(child, paneId, newPane));
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
