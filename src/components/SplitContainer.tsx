import { useCallback, useRef } from "react";
import type { LayoutNode } from "../types/split";
import type { Tab } from "./Sidebar";
import Terminal from "./Terminal";
import TextBoxInput from "./TextBoxInput";
import ResizeHandle from "./ResizeHandle";
import { updateSizes } from "../utils/layout";

interface SplitContainerProps {
  layout: LayoutNode;
  tabs: Tab[];
  activePaneId: string;
  textBoxVisible: boolean;
  fontFamily: string;
  fontSize: number;
  onTabIdCreated: (tabId: string, paneTabId: string) => void;
  onTitleChange: (tabId: string, title: string) => void;
  onLayoutChange: (layout: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => void;
  onPaneClick: (paneId: string) => void;
}

export default function SplitContainer({
  layout,
  tabs,
  activePaneId,
  textBoxVisible,
  fontFamily,
  fontSize,
  onTabIdCreated,
  onTitleChange,
  onLayoutChange,
  onPaneClick,
}: SplitContainerProps) {
  return (
    <LayoutRenderer
      node={layout}
      rootLayout={layout}
      tabs={tabs}
      activePaneId={activePaneId}
      textBoxVisible={textBoxVisible}
      fontFamily={fontFamily}
      fontSize={fontSize}
      onTabIdCreated={onTabIdCreated}
      onTitleChange={onTitleChange}
      onLayoutChange={onLayoutChange}
      onPaneClick={onPaneClick}
    />
  );
}

interface LayoutRendererProps {
  node: LayoutNode;
  rootLayout: LayoutNode;
  tabs: Tab[];
  activePaneId: string;
  textBoxVisible: boolean;
  fontFamily: string;
  fontSize: number;
  onTabIdCreated: (tabId: string, paneTabId: string) => void;
  onTitleChange: (tabId: string, title: string) => void;
  onLayoutChange: (layout: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => void;
  onPaneClick: (paneId: string) => void;
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

function LayoutRenderer({
  node,
  rootLayout,
  tabs,
  activePaneId,
  textBoxVisible,
  fontFamily,
  fontSize,
  onTabIdCreated,
  onTitleChange,
  onLayoutChange,
  onPaneClick,
}: LayoutRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback(
    (splitId: string, index: number, delta: number, direction: "horizontal" | "vertical") => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const totalSize = direction === "horizontal" ? container.offsetWidth : container.offsetHeight;
      if (totalSize === 0) return;

      const deltaPct = (delta / totalSize) * 100;
      const minSize = 10; // 最小10%

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
    const tab = tabs.find((t) => t.id === node.tabId);

    return (
      <div
        className={`split-pane${isActive ? " active" : ""}`}
        style={{ flex: 1 }}
        onMouseDown={() => onPaneClick(node.id)}
      >
        <Terminal
          tabId={node.tabId || null}
          onTabIdCreated={(id) => onTabIdCreated(id, node.tabId)}
          onTitleChange={(title) => {
            if (node.tabId) onTitleChange(node.tabId, title);
          }}
          isActive={isActive}
          isVisible={true}
          fontFamily={fontFamily}
          fontSize={fontSize}
        />
        {textBoxVisible && isActive && (
          <TextBoxInput tabId={tab?.id || null} />
        )}
      </div>
    );
  }

  // SplitNode
  return (
    <div
      ref={containerRef}
      className={`split-container ${node.direction}`}
    >
      {node.children.map((child, i) => (
        <SplitChild
          key={child.id}
          child={child}
          index={i}
          splitNode={node}
          rootLayout={rootLayout}
          tabs={tabs}
          activePaneId={activePaneId}
          textBoxVisible={textBoxVisible}
          fontFamily={fontFamily}
          fontSize={fontSize}
          onTabIdCreated={onTabIdCreated}
          onTitleChange={onTitleChange}
          onLayoutChange={onLayoutChange}
          onPaneClick={onPaneClick}
          onResize={handleResize}
          isLast={i === node.children.length - 1}
        />
      ))}
    </div>
  );
}

interface SplitChildProps {
  child: LayoutNode;
  index: number;
  splitNode: { type: "split"; id: string; direction: "horizontal" | "vertical"; children: LayoutNode[]; sizes: number[] };
  rootLayout: LayoutNode;
  tabs: Tab[];
  activePaneId: string;
  textBoxVisible: boolean;
  fontFamily: string;
  fontSize: number;
  onTabIdCreated: (tabId: string, paneTabId: string) => void;
  onTitleChange: (tabId: string, title: string) => void;
  onLayoutChange: (layout: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => void;
  onPaneClick: (paneId: string) => void;
  onResize: (splitId: string, index: number, delta: number, direction: "horizontal" | "vertical") => void;
  isLast: boolean;
}

function SplitChild({
  child,
  index,
  splitNode,
  rootLayout,
  tabs,
  activePaneId,
  textBoxVisible,
  fontFamily,
  fontSize,
  onTabIdCreated,
  onTitleChange,
  onLayoutChange,
  onPaneClick,
  onResize,
  isLast,
}: SplitChildProps) {
  return (
    <>
      <div style={{ flex: `${splitNode.sizes[index]} 0 0%`, minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex" }}>
        <LayoutRenderer
          node={child}
          rootLayout={rootLayout}
          tabs={tabs}
          activePaneId={activePaneId}
          textBoxVisible={textBoxVisible}
          fontFamily={fontFamily}
          fontSize={fontSize}
          onTabIdCreated={onTabIdCreated}
          onTitleChange={onTitleChange}
          onLayoutChange={onLayoutChange}
          onPaneClick={onPaneClick}
        />
      </div>
      {!isLast && (
        <ResizeHandle
          direction={splitNode.direction}
          onResize={(delta) =>
            onResize(splitNode.id, index, delta, splitNode.direction)
          }
        />
      )}
    </>
  );
}
