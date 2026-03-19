import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Terminal from "./components/Terminal";
import TextBoxInput from "./components/TextBoxInput";
import SplitFrame from "./components/SplitFrame";
import Sidebar, { type Tab, type TabStatus, generateTabUid } from "./components/Sidebar";
import SettingsModal from "./components/SettingsModal";
import UpdateNotice from "./components/UpdateNotice";
import NotificationPanel from "./components/NotificationPanel";
import { useNotifications } from "./hooks/useNotifications";
import { matchShortcut } from "./shortcuts";
import type { LayoutNode } from "./types/split";
import DropZoneOverlay, { type DropZone } from "./components/DropZoneOverlay";
import {
  findPaneById,
  findPaneByTabId,
  splitPane,
  splitPaneAt,
  closePane,
  replacePaneTab,
  getAllPaneIds,
  getAllTabIds,
  getAllPanesFlat,
  getNextPaneId,
  getPrevPaneId,
  generatePaneId,
  removePanesWithTabId,
  canSplitInDirection,
} from "./utils/layout";
import "./styles/global.css";

interface AppearanceSettings {
  font_family: string;
  font_size: number;
}

// AI Agentの検出パターン
const AGENT_PATTERNS = [
  /\bclaude\b/i,
  /\baider\b/i,
  /\bcopilot\b/i,
  /\bcursor\b/i,
  /\bgithub.copilot\b/i,
  /\bgemini\b/i,
  /\bcody\b/i,
];

function isAgentTitle(title: string): boolean {
  return AGENT_PATTERNS.some((p) => p.test(title));
}

function createTab(): Tab {
  return {
    uid: generateTabUid(),
    id: "",
    name: "",
    status: "idle",
  };
}

const initialPaneId = generatePaneId();

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [textBoxVisible, setTextBoxVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifyAgentDone, setNotifyAgentDone] = useState(true);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    font_family: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
    font_size: 14,
  });

  // Split layout state
  const [layout, setLayout] = useState<LayoutNode>({
    type: "pane",
    id: initialPaneId,
    tabId: "",
  });
  const [activePaneId, setActivePaneId] = useState<string>(initialPaneId);
  const isSplit = getAllPaneIds(layout).length > 1;

  // 通知システム
  const {
    notifications,
    unreadByTab,
    flashingTabIds,
    dispatch,
    markRead,
    markAllRead,
    clearAll,
  } = useNotifications(notifyAgentDone);

  // DOM移動用のref
  const terminalsContainerRef = useRef<HTMLDivElement>(null);
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const paneRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // 新タブ作成後に分割を実行するための保留状態
  const pendingSplitRef = useRef<{ paneId: string; direction: "horizontal" | "vertical" } | null>(null);
  const mainAreaRef = useRef<HTMLDivElement>(null);

  // DnD分割用の状態
  const [splitDragDisplay, setSplitDragDisplay] = useState<{
    dropZone: DropZone;
    targetRect: DOMRect;
    cursorX: number;
    cursorY: number;
    tabName: string;
  } | null>(null);
  const splitDragRef = useRef<{
    tabId: string;
    dropZone: DropZone;
    targetPaneId: string | null;
  } | null>(null);
  const registerTerminalRef = useCallback((tabId: string, el: HTMLDivElement | null) => {
    if (el) {
      terminalRefs.current.set(tabId, el);
    } else {
      terminalRefs.current.delete(tabId);
    }
  }, []);

  const paneRefCallback = useCallback((paneId: string, el: HTMLDivElement | null) => {
    if (el) {
      paneRefs.current.set(paneId, el);
    } else {
      // ペイン削除前にTerminal wrapperをcontainerに退避（DOM消失防止）
      const oldEl = paneRefs.current.get(paneId);
      if (oldEl && terminalsContainerRef.current) {
        const wrappers = Array.from(oldEl.querySelectorAll<HTMLDivElement>(".terminal-wrapper"));
        for (const w of wrappers) {
          w.style.display = "none";
          terminalsContainerRef.current.appendChild(w);
        }
      }
      paneRefs.current.delete(paneId);
    }
  }, []);

  // 通知権限をリクエスト
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    invoke<{ appearance: AppearanceSettings; notifications: { agent_done: boolean } }>("get_settings")
      .then((settings) => {
        const a = settings.appearance;
        setAppearance({
          font_family: a.font_family || "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
          font_size: a.font_size || 14,
        });
        if (settings.notifications != null) {
          setNotifyAgentDone(settings.notifications.agent_done);
        }
      })
      .catch(() => {});
  }, []);

  const activeTab = tabs[activeIndex] || tabs[0];

  // stale closure回避用のref
  const activePaneIdRef = useRef(activePaneId);
  activePaneIdRef.current = activePaneId;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const handleTabIdCreated = useCallback(
    (index: number, id: string) => {
      setTabs((prev) =>
        prev.map((tab, i) => (i === index ? { ...tab, id } : tab))
      );
      setLayout((prev) => {
        // 保留中の分割があれば、この新タブで実行する
        if (pendingSplitRef.current) {
          const { paneId, direction } = pendingSplitRef.current;
          pendingSplitRef.current = null;
          return splitPane(prev, paneId, direction, id);
        }
        // 初期ペインが空の場合にIDを反映
        const pane = findPaneByTabId(prev, "");
        if (pane) return replacePaneTab(prev, pane.id, id);
        return prev;
      });
    },
    []
  );

  const handleTitleChange = useCallback(
    (index: number, title: string) => {
      setTabs((prev) =>
        prev.map((tab, i) => {
          if (i !== index) return tab;
          const agentDetected = isAgentTitle(title);
          let status: TabStatus = tab.status;
          if (agentDetected) {
            status = "agent-running";
          } else if (tab.status === "agent-running") {
            status = "agent-done";
            dispatch({
              title: "Agent completed",
              body: `Tab "${tab.name}" の処理が完了しました`,
              source: "agent",
              tabId: tab.id,
            });
          }
          return { ...tab, name: title, status };
        })
      );
    },
    [dispatch]
  );

  const handleOscNotification = useCallback(
    (index: number, title: string, body: string) => {
      const tab = tabs[index];
      if (!tab) return;
      dispatch({ title, body, source: "osc", tabId: tab.id });
    },
    [tabs, dispatch]
  );

  const handleTabSelect = useCallback(
    (id: string) => {
      const index = tabs.findIndex((t) => t.id === id);
      if (index >= 0) {
        setActiveIndex(index);
        markRead(id);
      }
      if (isSplit) {
        const pane = findPaneByTabId(layout, id);
        if (pane) setActivePaneId(pane.id);
      }
    },
    [tabs, layout, isSplit, markRead]
  );

  const handleNewTab = useCallback(() => {
    const newTab = createTab();
    setTabs((prev) => {
      setActiveIndex(prev.length);
      return [...prev, newTab];
    });
  }, []);

  const handleCloseTab = useCallback(
    (id: string) => {
      invoke("close_pty", { tabId: id }).catch(() => {});

      if (isSplit) {
        setLayout((prev) => {
          const result = removePanesWithTabId(prev, id);
          return result ?? prev;
        });
      }

      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) return prev;
        return next;
      });
      setActiveIndex((prev) => {
        const closedIndex = tabs.findIndex((t) => t.id === id);
        if (closedIndex < 0) return prev;
        if (prev >= tabs.length - 1) return Math.max(0, tabs.length - 2);
        if (prev > closedIndex) return prev - 1;
        return prev;
      });
    },
    [tabs, isSplit]
  );

  const handleReorderTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTabs((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
      setActiveIndex((prev) => {
        if (prev === fromIndex) return toIndex;
        if (fromIndex < prev && toIndex >= prev) return prev - 1;
        if (fromIndex > prev && toIndex <= prev) return prev + 1;
        return prev;
      });
    },
    []
  );

  const handleAppearanceChange = useCallback((fontFamily: string, fontSize: number) => {
    setAppearance({ font_family: fontFamily, font_size: fontSize });
  }, []);

  // --- 分割操作 ---

  const handleSplitHorizontal = useCallback(() => {
    if (!canSplitInDirection(layout, activePaneId, "horizontal")) return;
    const tabIdsInLayout = getAllTabIds(layout);
    const availableTab = tabs.find((t) => t.id && !tabIdsInLayout.includes(t.id));
    if (!availableTab) return;

    if (!isSplit && activeTab?.id) {
      setLayout((prev) => {
        const updated = replacePaneTab(prev, activePaneId, activeTab.id);
        return splitPane(updated, activePaneId, "horizontal", availableTab.id);
      });
    } else if (isSplit) {
      setLayout((prev) => splitPane(prev, activePaneId, "horizontal", availableTab.id));
    }
  }, [activePaneId, isSplit, activeTab, layout, tabs]);

  const handleSplitVertical = useCallback(() => {
    if (!canSplitInDirection(layout, activePaneId, "vertical")) return;
    const tabIdsInLayout = getAllTabIds(layout);
    const availableTab = tabs.find((t) => t.id && !tabIdsInLayout.includes(t.id));
    if (!availableTab) return;

    if (!isSplit && activeTab?.id) {
      setLayout((prev) => {
        const updated = replacePaneTab(prev, activePaneId, activeTab.id);
        return splitPane(updated, activePaneId, "vertical", availableTab.id);
      });
    } else if (isSplit) {
      setLayout((prev) => splitPane(prev, activePaneId, "vertical", availableTab.id));
    }
  }, [activePaneId, isSplit, activeTab, layout, tabs]);

  // サイドバーの右クリックメニューから既存タブを分割表示
  const handleSplitTab = useCallback(
    (tabId: string, direction: "horizontal" | "vertical") => {
      if (!canSplitInDirection(layout, activePaneId, direction)) return;
      if (tabId === activeTab?.id) {
        // アクティブタブを右クリック: ペインにアクティブタブを反映してから別タブを探す
        const updatedLayout = !isSplit
          ? replacePaneTab(layout, activePaneId, activeTab.id)
          : layout;
        const tabIdsInUpdatedLayout = getAllTabIds(updatedLayout);
        const availableTab = tabs.find((t) => t.id && !tabIdsInUpdatedLayout.includes(t.id));
        if (availableTab) {
          setLayout(() => splitPane(updatedLayout, activePaneId, direction, availableTab.id));
        } else {
          // 利用可能なタブがない: 新タブを作成して分割
          if (!isSplit) setLayout(updatedLayout);
          pendingSplitRef.current = { paneId: activePaneId, direction };
          setTabs((prev) => [...prev, createTab()]);
        }
        return;
      }

      if (!isSplit && activeTab?.id) {
        setLayout((prev) => {
          const updated = replacePaneTab(prev, activePaneId, activeTab.id);
          return splitPane(updated, activePaneId, direction, tabId);
        });
      } else {
        setLayout((prev) => splitPane(prev, activePaneId, direction, tabId));
      }
    },
    [activePaneId, isSplit, activeTab, layout, tabs]
  );

  // --- DnD分割ハンドラ（カスタムマウスイベント） ---

  const handleStartDragToSplit = useCallback((tabId: string, tabName: string) => {
    splitDragRef.current = { tabId, dropZone: null, targetPaneId: null };

    const handleMouseMove = (e: MouseEvent) => {
      const mainArea = mainAreaRef.current;
      if (!mainArea || !splitDragRef.current) return;

      let rect: DOMRect | undefined;
      let targetPaneId: string | null = null;

      // 分割済みの場合、カーソル下のペインを特定
      for (const [paneId, paneEl] of paneRefs.current) {
        const paneRect = paneEl.getBoundingClientRect();
        if (e.clientX >= paneRect.left && e.clientX <= paneRect.right &&
            e.clientY >= paneRect.top && e.clientY <= paneRect.bottom) {
          rect = paneRect;
          targetPaneId = paneId;
          break;
        }
      }

      if (!rect) rect = mainArea.getBoundingClientRect();

      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const threshold = 0.33;
      let zone: DropZone = null;

      if (relX >= 0 && relX <= rect.width && relY >= 0 && relY <= rect.height) {
        if (relX < rect.width * threshold) zone = "left";
        else if (relX > rect.width * (1 - threshold)) zone = "right";
        else if (relY < rect.height * threshold) zone = "top";
        else if (relY > rect.height * (1 - threshold)) zone = "bottom";
      }

      // 分割制限チェック: 許可されない方向のゾーンを無効化
      if (zone && targetPaneId) {
        const dir: "horizontal" | "vertical" =
          (zone === "left" || zone === "right") ? "horizontal" : "vertical";
        if (!canSplitInDirection(layoutRef.current, targetPaneId, dir)) {
          zone = null;
        }
      }

      splitDragRef.current.dropZone = zone;
      splitDragRef.current.targetPaneId = targetPaneId;
      setSplitDragDisplay({ dropZone: zone, targetRect: rect, cursorX: e.clientX, cursorY: e.clientY, tabName });
    };

    const handleMouseUp = () => {
      const data = splitDragRef.current;
      if (data && data.dropZone) {
        const { tabId: dragTabId, dropZone, targetPaneId } = data;
        const direction: "horizontal" | "vertical" =
          (dropZone === "left" || dropZone === "right") ? "horizontal" : "vertical";
        const position: "before" | "after" =
          (dropZone === "left" || dropZone === "top") ? "before" : "after";

        const currentActivePaneId = activePaneIdRef.current;
        const currentActiveTab = activeTabRef.current;
        const paneId = targetPaneId || currentActivePaneId;

        // 分割制限の最終チェック
        if (!canSplitInDirection(layoutRef.current, paneId, direction)) {
          splitDragRef.current = null;
          setSplitDragDisplay(null);
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        setLayout((prev) => {
          const allPanes = getAllPaneIds(prev);
          if (allPanes.length <= 1) {
            let updated = prev;
            if (currentActiveTab?.id && currentActiveTab.id !== dragTabId) {
              // アクティブタブとドラッグタブが異なる場合のみペインを更新
              updated = replacePaneTab(prev, currentActivePaneId, currentActiveTab.id);
            } else {
              // ドラッグタブ＝アクティブタブの場合、ペインに既に別タブがあるならそのまま
              const existingPane = findPaneById(prev, currentActivePaneId);
              if (!existingPane?.tabId || existingPane.tabId === dragTabId) {
                return prev; // 分割先の別タブがない
              }
            }
            return splitPaneAt(updated, paneId, direction, dragTabId, position);
          }
          return splitPaneAt(prev, paneId, direction, dragTabId, position);
        });
      }

      splitDragRef.current = null;
      setSplitDragDisplay(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  // ペインを閉じる（タブは残す）
  const handleClosePane = useCallback(() => {
    const allPaneIds = getAllPaneIds(layout);
    if (allPaneIds.length <= 1) return;

    const nextPaneId = getNextPaneId(layout, activePaneId);
    const newLayout = closePane(layout, activePaneId);
    if (newLayout) {
      setLayout(newLayout);
      if (nextPaneId && nextPaneId !== activePaneId) {
        setActivePaneId(nextPaneId);
        const nextPane = findPaneById(newLayout, nextPaneId);
        if (nextPane) {
          const idx = tabs.findIndex((t) => t.id === nextPane.tabId);
          if (idx >= 0) setActiveIndex(idx);
        }
      }
    }
  }, [layout, activePaneId, tabs]);

  const handlePaneClick = useCallback(
    (paneId: string) => {
      if (paneId === activePaneId) return;
      setActivePaneId(paneId);
      const pane = findPaneById(layout, paneId);
      if (pane && pane.tabId) {
        const idx = tabs.findIndex((t) => t.id === pane.tabId);
        if (idx >= 0) setActiveIndex(idx);
      }
    },
    [layout, tabs, activePaneId]
  );

  const displayedTabIds = getAllTabIds(layout);

  // --- DOM直接操作によるTerminal移動（再マウントなし） ---
  // 依存配列を最小限に: tabs配列はタイトル/ステータス変更で頻繁に更新されるため除外
  const activeTabUid = tabs[activeIndex]?.uid;
  const activeTabHasId = !!tabs[activeIndex]?.id;
  useLayoutEffect(() => {
    if (!terminalsContainerRef.current) return;
    const container = terminalsContainerRef.current;

    if (isSplit) {
      const panes = getAllPanesFlat(layout);
      const displayedIds = new Set(panes.map((p) => p.tabId));

      for (const pane of panes) {
        const termEl = terminalRefs.current.get(pane.tabId);
        const paneEl = paneRefs.current.get(pane.id);
        if (termEl && paneEl && termEl.parentElement !== paneEl) {
          paneEl.appendChild(termEl);
        }
        if (termEl) termEl.style.display = "flex";
      }

      // レイアウト外のTerminalは非表示にしてcontainerに戻す
      for (const [tabId, termEl] of terminalRefs.current) {
        if (!displayedIds.has(tabId)) {
          termEl.style.display = "none";
          if (termEl.parentElement !== container) {
            container.appendChild(termEl);
          }
        }
      }

      // id未取得のwrapper（初期化中）も非表示
      const wrappers = container.querySelectorAll<HTMLDivElement>(".terminal-wrapper");
      wrappers.forEach((w) => { w.style.display = "none"; });
    } else {
      // 非分割モード: 全Terminalをcontainerに戻してアクティブのみ表示
      for (const [tabId, termEl] of terminalRefs.current) {
        if (termEl.parentElement !== container) {
          container.appendChild(termEl);
        }
        termEl.style.display = tabId === activeTab?.id ? "flex" : "none";
      }

      // id未取得のアクティブタブも表示
      if (!activeTabHasId && activeTabUid) {
        const wrapper = container.querySelector<HTMLDivElement>(
          `.terminal-wrapper[data-tab-uid="${activeTabUid}"]`
        );
        if (wrapper) wrapper.style.display = "flex";
      }
    }
  }, [layout, isSplit, activeTab?.id, activeIndex, activeTabUid, activeTabHasId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) return;

      const action = matchShortcut(e);
      if (!action) return;

      e.preventDefault();
      switch (action) {
        case "toggle-textbox":
          setTextBoxVisible((prev) => !prev);
          break;
        case "new-tab":
          handleNewTab();
          break;
        case "close-tab": {
          const paneCount = getAllPaneIds(layout).length;
          if (paneCount > 1) {
            handleClosePane();
          } else if (activeTab?.id && tabs.length > 1) {
            handleCloseTab(activeTab.id);
          }
          break;
        }
        case "next-tab":
          setActiveIndex((prev) => (prev + 1) % tabs.length);
          break;
        case "prev-tab":
          setActiveIndex((prev) => (prev - 1 + tabs.length) % tabs.length);
          break;
        case "open-settings":
          setSettingsOpen(true);
          break;
        case "notification-panel":
          setNotificationPanelOpen((prev) => !prev);
          break;
        case "split-horizontal":
          handleSplitHorizontal();
          break;
        case "split-vertical":
          handleSplitVertical();
          break;
        case "next-pane": {
          const nextId = getNextPaneId(layout, activePaneId);
          if (nextId) {
            setActivePaneId(nextId);
            const pane = findPaneById(layout, nextId);
            if (pane && pane.tabId) {
              const idx = tabs.findIndex((t) => t.id === pane.tabId);
              if (idx >= 0) setActiveIndex(idx);
            }
          }
          break;
        }
        case "prev-pane": {
          const prevId = getPrevPaneId(layout, activePaneId);
          if (prevId) {
            setActivePaneId(prevId);
            const pane = findPaneById(layout, prevId);
            if (pane && pane.tabId) {
              const idx = tabs.findIndex((t) => t.id === pane.tabId);
              if (idx >= 0) setActiveIndex(idx);
            }
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen, tabs, activeTab, handleNewTab, handleCloseTab, handleSplitHorizontal, handleSplitVertical, handleClosePane, layout, activePaneId]);

  // 分割モード時のアクティブペインのtabId
  const activePaneTabId = isSplit
    ? findPaneById(layout, activePaneId)?.tabId || null
    : null;

  return (
    <div className="app">
      <Sidebar
        tabs={tabs.filter((t) => t.id !== "")}
        activeTabId={activeTab?.id || null}
        displayedTabIds={isSplit ? displayedTabIds : []}
        onTabSelect={handleTabSelect}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        onReorderTabs={handleReorderTabs}
        onOpenSettings={() => setSettingsOpen(true)}
        onSplitTab={handleSplitTab}
        onStartDragToSplit={handleStartDragToSplit}
        onToggleNotifications={() => setNotificationPanelOpen((prev) => !prev)}
        unreadCount={notifications.filter((n) => !n.read).length}
        flashingTabIds={flashingTabIds}
        unreadByTab={unreadByTab}
      />
      <div
        className={`main-area${splitDragDisplay ? " drag-active" : ""}`}
        ref={mainAreaRef}
      >
        {/* 分割フレーム（ペイン枠のみ、Terminalは DOM 操作で移動） */}
        {isSplit && (
          <SplitFrame
            layout={layout}
            activePaneId={activePaneId}
            onLayoutChange={setLayout}
            onPaneClick={handlePaneClick}
            paneRefCallback={paneRefCallback}
          />
        )}

        {/* 全Terminal（常にマウント、display制御は useLayoutEffect で行う） */}
        <div
          ref={terminalsContainerRef}
          className={`terminals-container${isSplit ? " hidden-container" : ""}`}
        >
          {tabs.map((tab, index) => (
            <div
              key={tab.uid}
              ref={(el) => {
                if (tab.id) registerTerminalRef(tab.id, el);
              }}
              className="terminal-wrapper"
              data-tab-id={tab.id}
              data-tab-uid={tab.uid}
            >
              <Terminal
                tabId={tab.id || null}
                onTabIdCreated={(id) => handleTabIdCreated(index, id)}
                onTitleChange={(title) => handleTitleChange(index, title)}
                onOscNotification={(title, body) => handleOscNotification(index, title, body)}
                isActive={isSplit ? tab.id === activePaneTabId : index === activeIndex}
                isVisible={isSplit ? displayedTabIds.includes(tab.id) : false}
                fontFamily={appearance.font_family}
                fontSize={appearance.font_size}
              />
              {textBoxVisible && (isSplit ? tab.id === activePaneTabId : index === activeIndex) && (
                <TextBoxInput tabId={tab.id || null} />
              )}
            </div>
          ))}
        </div>
      </div>

      {splitDragDisplay && (
        <>
          <DropZoneOverlay
            targetRect={splitDragDisplay.targetRect}
            activeZone={splitDragDisplay.dropZone}
          />
          <div
            className="drag-ghost"
            style={{ left: splitDragDisplay.cursorX, top: splitDragDisplay.cursorY }}
          >
            {splitDragDisplay.tabName}
          </div>
        </>
      )}

      {notificationPanelOpen && (
        <NotificationPanel
          notifications={notifications}
          onMarkAllRead={markAllRead}
          onClearAll={clearAll}
          onClose={() => setNotificationPanelOpen(false)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onAppearanceChange={handleAppearanceChange}
          onNotificationChange={setNotifyAgentDone}
        />
      )}
      <UpdateNotice />
    </div>
  );
}
