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
  onStartDragToSplit: (tabId: string, tabName: string) => void;
  onToggleNotifications: () => void;
  unreadCount: number;
  flashingTabIds?: Set<string>;
  unreadByTab?: Map<string, number>;
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
  onStartDragToSplit,
  onToggleNotifications,
  unreadCount,
  flashingTabIds,
  unreadByTab,
}: SidebarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ドラッグ状態（ビジュアルフィードバック用）
  const [dragVisual, setDragVisual] = useState<{
    draggingIndex: number;
    dropTargetIndex: number | null;
  } | null>(null);

  // ドラッグ追跡用ref（mousemove中の再レンダリングを避ける）
  const dragRef = useRef<{
    tabIndex: number;
    tabId: string;
    tabName: string;
    startX: number;
    startY: number;
    mode: "idle" | "reorder" | "split";
  } | null>(null);
  const dropTargetRef = useRef<number | null>(null);
  const tabRectsRef = useRef<DOMRect[]>([]);

  const handleTabMouseDown = useCallback((e: React.MouseEvent, index: number, tab: Tab) => {
    if (e.button !== 0) return;

    dragRef.current = {
      tabIndex: index,
      tabId: tab.id,
      tabName: tab.name || "Terminal",
      startX: e.clientX,
      startY: e.clientY,
      mode: "idle",
    };
    dropTargetRef.current = null;

    // タブ位置をキャプチャ
    const tabEls = sidebarRef.current?.querySelectorAll(".sidebar-tab");
    if (tabEls) {
      tabRectsRef.current = Array.from(tabEls).map(el => el.getBoundingClientRect());
    }

    const handleMouseMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (drag.mode === "idle" && dist < 5) return;

      const sidebarRect = sidebarRef.current?.getBoundingClientRect();
      if (!sidebarRect) return;

      if (drag.mode === "idle") {
        if (ev.clientX > sidebarRect.right) {
          drag.mode = "split";
          onStartDragToSplit(drag.tabId, drag.tabName);
          setDragVisual({ draggingIndex: drag.tabIndex, dropTargetIndex: null });
          return;
        }
        drag.mode = "reorder";
        setDragVisual({ draggingIndex: drag.tabIndex, dropTargetIndex: null });
      }

      if (drag.mode === "split") return;

      // リオーダー中にサイドバー外に出たら分割モードへ
      if (ev.clientX > sidebarRect.right) {
        drag.mode = "split";
        onStartDragToSplit(drag.tabId, drag.tabName);
        setDragVisual(prev => prev ? { ...prev, dropTargetIndex: null } : null);
        return;
      }

      // ドロップ位置を計算
      let dropIdx = drag.tabIndex;
      for (let i = 0; i < tabRectsRef.current.length; i++) {
        const rect = tabRectsRef.current[i];
        const midY = rect.top + rect.height / 2;
        if (ev.clientY < midY) {
          dropIdx = i;
          break;
        }
        if (i === tabRectsRef.current.length - 1) {
          dropIdx = i;
        }
      }

      dropTargetRef.current = dropIdx !== drag.tabIndex ? dropIdx : null;
      setDragVisual(prev => prev ? {
        ...prev,
        dropTargetIndex: dropTargetRef.current,
      } : null);
    };

    const handleMouseUp = () => {
      const drag = dragRef.current;
      if (drag && drag.mode === "reorder" && dropTargetRef.current !== null) {
        onReorderTabs(drag.tabIndex, dropTargetRef.current);
      }

      dragRef.current = null;
      dropTargetRef.current = null;
      setDragVisual(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [onStartDragToSplit, onReorderTabs]);

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
    <div className="sidebar" ref={sidebarRef}>
      {/* Top toolbar */}
      <div className="sidebar-toolbar">
        <button className="sidebar-tool-btn" onClick={onOpenSettings} title="Settings (Ctrl+,)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
          </svg>
        </button>
        <button className="sidebar-tool-btn notification-bell-btn" onClick={onToggleNotifications} title="通知 (Ctrl+Shift+N)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z"/>
          </svg>
          {unreadCount > 0 && (
            <span className="notification-bell-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
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
            className={`sidebar-tab${tab.id === activeTabId ? " active" : ""} ${tab.status}${dragVisual?.dropTargetIndex === index && dragVisual.draggingIndex !== index ? " drop-target" : ""}${dragVisual?.draggingIndex === index ? " dragging" : ""}${flashingTabIds?.has(tab.id) ? " tab-flash" : ""}`}
            onClick={() => onTabSelect(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            onMouseDown={(e) => handleTabMouseDown(e, index, tab)}
          >
            <div className="tab-header">
              <span className="tab-title">{tab.name || "Terminal"}</span>
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                  title="Close tab"
                >
                  &times;
                </button>
              )}
            </div>
            <div className="tab-meta">
              <span className="tab-shell">shell</span>
              {displayedTabIds.includes(tab.id) && tab.id !== activeTabId && (
                <span className="tab-displayed-dot" title="分割表示中" />
              )}
              {tab.status !== "idle" && (
                <span className={`tab-status-dot ${tab.status}`} />
              )}
              {(unreadByTab?.get(tab.id) || 0) > 0 && (
                <span className="tab-unread-badge" />
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
            onClick={() => { onSplitTab(contextMenu.tabId, "horizontal"); setContextMenu(null); }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h5v12H2V2zm1 1v10h3V3H3zm6-1h5v12H9V2zm1 1v10h3V3h-3z"/>
            </svg>
            右に分割表示
          </button>
          <button
            className="context-menu-item"
            onClick={() => { onSplitTab(contextMenu.tabId, "vertical"); setContextMenu(null); }}
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
                onClick={() => { onCloseTab(contextMenu.tabId); setContextMenu(null); }}
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
