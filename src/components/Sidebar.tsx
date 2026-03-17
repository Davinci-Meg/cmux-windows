import { useState, useCallback, useRef, useEffect } from "react";

type TabStatus = "idle" | "agent-running" | "agent-done";

let tabUidCounter = 0;
export function generateTabUid(): string {
  tabUidCounter += 1;
  return `tab-uid-${tabUidCounter}`;
}

interface Tab {
  uid: string;
  id: string;
  name: string;
  status: TabStatus;
}

interface SidebarProps {
  tabs: Tab[];
  activeTabId: string | null;
  displayedTabIds: string[];
  onTabSelect: (id: string) => void;
  onNewTab: () => void;
  onCloseTab: (id: string) => void;
  onReorderTabs: (fromIndex: number, toIndex: number) => void;
  onOpenSettings: () => void;
  onSplitTab: (tabId: string, direction: "horizontal" | "vertical") => void;
}

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

export default function Sidebar({
  tabs,
  activeTabId,
  displayedTabIds,
  onTabSelect,
  onNewTab,
  onCloseTab,
  onReorderTabs,
  onOpenSettings,
  onSplitTab,
}: SidebarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      dragNodeRef.current = e.currentTarget as HTMLDivElement;
      e.dataTransfer.effectAllowed = "move";
      requestAnimationFrame(() => {
        if (dragNodeRef.current) {
          dragNodeRef.current.classList.add("dragging");
        }
      });
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIndex !== null && index !== dragIndex) {
        setDropIndex(index);
      }
    },
    [dragIndex]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== toIndex) {
        onReorderTabs(dragIndex, toIndex);
      }
      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, onReorderTabs]
  );

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove("dragging");
    }
    setDragIndex(null);
    setDropIndex(null);
    dragNodeRef.current = null;
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      setContextMenu({ tabId, x: e.clientX, y: e.clientY });
    },
    []
  );

  // コンテキストメニュー外クリックで閉じる
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  return (
    <div className="sidebar">
      {/* Top toolbar */}
      <div className="sidebar-toolbar">
        <button className="sidebar-tool-btn" onClick={onOpenSettings} title="Settings (Ctrl+,)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
          </svg>
        </button>
        <button className="sidebar-tool-btn" onClick={onNewTab} title="New Tab (Ctrl+Shift+T)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
          </svg>
        </button>
      </div>

      {/* Tab cards */}
      <div className="sidebar-tabs">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`sidebar-tab${tab.id === activeTabId ? " active" : ""} ${tab.status}${dropIndex === index && dragIndex !== null && dragIndex !== index ? " drop-target" : ""}`}
            onClick={() => onTabSelect(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            <div className="tab-header">
              <span className="tab-title">{tab.name || "Terminal"}</span>
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title="Close tab"
                >
                  &times;
                </button>
              )}
            </div>
            <div className="tab-meta">
              <span className="tab-shell">shell</span>
              {displayedTabIds.includes(tab.id) && tab.id !== activeTabId && (
                <span className="tab-displayed-dot" title="Displayed in split view" />
              )}
              {tab.status !== "idle" && (
                <span className={`tab-status-dot ${tab.status}`} />
              )}
              <span className="tab-id">{tab.id.slice(0, 8)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              onSplitTab(contextMenu.tabId, "horizontal");
              setContextMenu(null);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h5v12H2V2zm1 1v10h3V3H3zm6-1h5v12H9V2zm1 1v10h3V3h-3z"/>
            </svg>
            右に分割表示
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onSplitTab(contextMenu.tabId, "vertical");
              setContextMenu(null);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h12v5H2V2zm1 1v3h10V3H3zM2 9h12v5H2V9zm1 1v3h10v-3H3z"/>
            </svg>
            下に分割表示
          </button>
          {tabs.length > 1 && (
            <>
              <div className="context-menu-separator" />
              <button
                className="context-menu-item danger"
                onClick={() => {
                  onCloseTab(contextMenu.tabId);
                  setContextMenu(null);
                }}
              >
                タブを閉じる
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export type { Tab, TabStatus };
