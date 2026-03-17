export interface PaneNode {
  type: "pane";
  id: string;
  tabId: string;
}

export interface SplitNode {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  children: LayoutNode[];
  sizes: number[];
}

export type LayoutNode = PaneNode | SplitNode;
