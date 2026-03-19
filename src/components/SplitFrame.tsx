import { useCallback, useRef } from "react";
import type { LayoutNode } from "../types/split";
import ResizeHandle from "./ResizeHandle";
import { updateSizes } from "../utils/layout";

interface SplitFrameProps {
  layout: LayoutNode;
  activePaneId: string;
  onLayoutChange: (layout: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => void;
  onPaneClick: (paneId: string) => void;
  paneRefCallback: (paneId: string, el: HTMLDivElement | null) => void;
}

export default function SplitFrame({
  layout,
  activePaneId,
  onLayoutChange,
  onPaneClick,
  paneRefCallback,
}: SplitFrameProps) {
  return (
    <FrameRenderer
      node={layout}
      rootLayout={layout}
      activePaneId={activePaneId}
      onLayoutChange={onLayoutChange}
      onPaneClick={onPaneClick}
      paneRefCallback={paneRefCallback}
    />
  );
}

interface FrameRendererProps {
  node: LayoutNode;
  rootLayout: LayoutNode;
  activePaneId: string;
  onLayoutChange: (layout: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => void;
  onPaneClick: (paneId: string) => void;
  paneRefCallback: (paneId: string, el: HTMLDivElement | null) => void;
}

function findSplitById(node: LayoutNode, splitId: string): { sizes: number[] } | null {
  if (node.type === "pane") return null;
  if (node.id === splitId) return { sizes: node.sizes };
  for (const child of node.children) {
    const found = findSplitById(child, splitId);
    if (found) return found;
  }
  return null;
}

function FrameRenderer({
  node,
  rootLayout,
  activePaneId,
  onLayoutChange,
  onPaneClick,
  paneRefCallback,
}: FrameRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback(
    (splitId: string, index: number, delta: number, direction: "horizontal" | "vertical") => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const totalSize = direction === "horizontal" ? container.offsetWidth : container.offsetHeight;
      if (totalSize === 0) return;

      const deltaPct = (delta / totalSize) * 100;
      const minSize = 10;

      onLayoutChange((prev: LayoutNode) => {
        const splitNode = findSplitById(prev, splitId);
        if (!splitNode) return prev;

        const newSizes = [...splitNode.sizes];
        newSizes[index] += deltaPct;
        newSizes[index + 1] -= deltaPct;

        if (newSizes[index] < minSize || newSizes[index + 1] < minSize) return prev;

        return updateSizes(prev, splitId, newSizes);
      });
    },
    [onLayoutChange]
  );

  if (node.type === "pane") {
    const isActive = node.id === activePaneId;
    return (
      <div
        className={`split-pane${isActive ? " active" : ""}`}
        style={{ flex: 1 }}
        onMouseDown={() => onPaneClick(node.id)}
        ref={(el) => paneRefCallback(node.id, el)}
        data-pane-id={node.id}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`split-container ${node.direction}`}
    >
      {node.children.map((child, i) => (
        <FrameChild
          key={child.id}
          child={child}
          index={i}
          splitNode={node}
          rootLayout={rootLayout}
          activePaneId={activePaneId}
          onLayoutChange={onLayoutChange}
          onPaneClick={onPaneClick}
          paneRefCallback={paneRefCallback}
          onResize={handleResize}
          isLast={i === node.children.length - 1}
        />
      ))}
    </div>
  );
}

interface FrameChildProps {
  child: LayoutNode;
  index: number;
  splitNode: { type: "split"; id: string; direction: "horizontal" | "vertical"; children: LayoutNode[]; sizes: number[] };
  rootLayout: LayoutNode;
  activePaneId: string;
  onLayoutChange: (layout: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => void;
  onPaneClick: (paneId: string) => void;
  paneRefCallback: (paneId: string, el: HTMLDivElement | null) => void;
  onResize: (splitId: string, index: number, delta: number, direction: "horizontal" | "vertical") => void;
  isLast: boolean;
}

function FrameChild({
  child,
  index,
  splitNode,
  rootLayout,
  activePaneId,
  onLayoutChange,
  onPaneClick,
  paneRefCallback,
  onResize,
  isLast,
}: FrameChildProps) {
  return (
    <>
      <div style={{ flex: `${splitNode.sizes[index]} 0 0%`, minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex" }}>
        <FrameRenderer
          node={child}
          rootLayout={rootLayout}
          activePaneId={activePaneId}
          onLayoutChange={onLayoutChange}
          onPaneClick={onPaneClick}
          paneRefCallback={paneRefCallback}
        />
      </div>
      {!isLast && (
        <ResizeHandle
          direction={splitNode.direction}
          onResize={(delta) => onResize(splitNode.id, index, delta, splitNode.direction)}
        />
      )}
    </>
  );
}
