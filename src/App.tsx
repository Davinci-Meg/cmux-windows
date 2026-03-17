import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Terminal from "./components/Terminal";
import TextBoxInput from "./components/TextBoxInput";
import SplitFrame from "./components/SplitFrame";
import Sidebar, { type Tab, type TabStatus, generateTabUid } from "./components/Sidebar";
import SettingsModal from "./components/SettingsModal";
import UpdateNotice from "./components/UpdateNotice";
import { matchShortcut } from "./shortcuts";
import type { LayoutNode } from "./types/split";
import {
  findPaneById,
  findPaneByTabId,
  splitPane,
  closePane,
  replacePaneTab,
  getAllPaneIds,
  getAllTabIds,
  getAllPanesFlat,
  getNextPaneId,
  getPrevPaneId,
  generatePaneId,
  removePanesWithTabId,
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

  // DOM移動用のref
  const terminalsContainerRef = useRef<HTMLDivElement>(null);
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const paneRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // --- tabId基準の統一コールバック ---

  const handleTabIdCreated = useCallback(
    (index: number, id: string) => {
      setTabs((prev) =>
        prev.map((tab, i) => (i === index ? { ...tab, id } : tab))
      );
      // レイアウトのペインにもIDを反映
      setLayout((prev) => {
        const pane = findPaneByTabId(prev, "");
        if (pane) return replacePaneTab(prev, pane.id, id);
        return prev;
      });
    },
    []
  );

  const notifyRef = useRef(notifyAgentDone);
  useEffect(() => { notifyRef.current = notifyAgentDone; }, [notifyAgentDone]);

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
            if (notifyRef.current && Notification.permission === "granted") {
              new Notification("Agent completed", {
                body: `Tab "${tab.name}" の処理が完了しました`,
              });
            }
          }
          return { ...tab, name: title, status };
        })
      );
    },
    []
  );

  // --- 共通ハンドラー ---

  const handleTabSelect = useCallback(
    (id: string) => {
      const index = tabs.findIndex((t) => t.id === id);
      if (index >= 0) setActiveIndex(index);

      if (isSplit) {
        const pane = findPaneByTabId(layout, id);
        if (pane) {
          setActivePaneId(pane.id);
        }
      }
    },
    [tabs, layout, isSplit]
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

  // --- 分割操作（タブ作成なし） ---

  const handleSplitHorizontal = useCallback(() => {
    // タブが2つ以上あり、レイアウトにないタブがあれば次のタブを使って分割
    const tabIdsInLayout = getAllTabIds(layout);
    const availableTab = tabs.find((t) => t.id && !tabIdsInLayout.includes(t.id));

    if (!availableTab) return; // 使えるタブがなければ何もしない

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

  // 右クリックから既存タブを分割表示
  const handleSplitTab = useCallback(
    (tabId: string, direction: "horizontal" | "vertical") => {
      // 自分自身とは分割できない
      if (tabId === activeTab?.id) return;

      if (!isSplit && activeTab?.id) {
        // 単一ペイン → 分割: アクティブタブを左/上、指定タブを右/下
        setLayout((prev) => {
          const updated = replacePaneTab(prev, activePaneId, activeTab.id);
          return splitPane(updated, activePaneId, direction, tabId);
        });
      } else {
        // 既に分割中: アクティブペインを分割して指定タブを配置
        setLayout((prev) => splitPane(prev, activePaneId, direction, tabId));
      }
    },
    [activePaneId, isSplit, activeTab]
  );

  // ペインを閉じる（タブは閉じない、分割から外すだけ）
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

  // --- DOM直接操作によるTerminal移動 ---
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

      // レイアウト外のTerminalは非表示にして元の場所に戻す
      for (const [tabId, termEl] of terminalRefs.current) {
        if (!displayedIds.has(tabId)) {
          termEl.style.display = "none";
          if (termEl.parentElement !== container) {
            container.appendChild(termEl);
          }
        }
      }

      // id未取得のtab(Terminal初期化中)も非表示にする
      const wrappers = container.querySelectorAll<HTMLDivElement>(".terminal-wrapper");
      wrappers.forEach((w) => { w.style.display = "none"; });
    } else {
      // フラットモード: 全Terminalを元のcontainerに戻す
      for (const [tabId, termEl] of terminalRefs.current) {
        if (termEl.parentElement !== container) {
          container.appendChild(termEl);
        }
        termEl.style.display = tabId === activeTab?.id ? "flex" : "none";
      }

      // id未取得のアクティブタブも表示する
      const activeTabObj = tabs[activeIndex];
      if (activeTabObj && !activeTabObj.id) {
        const wrapper = container.querySelector<HTMLDivElement>(
          `.terminal-wrapper[data-tab-uid="${activeTabObj.uid}"]`
        );
        if (wrapper) wrapper.style.display = "flex";
      }
    }
  }, [layout, isSplit, activeTab?.id, activeIndex, tabs]);

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

  // 分割モード時のアクティブペインのtabIdを取得
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
      />
      <div className="main-area">
        {/* 分割フレーム（空のpane枠のみ） */}
        {isSplit && (
          <SplitFrame
            layout={layout}
            activePaneId={activePaneId}
            onLayoutChange={setLayout}
            onPaneClick={handlePaneClick}
            paneRefCallback={paneRefCallback}
          />
        )}

        {/* 全Terminal（常にマウント、display制御はuseLayoutEffectで行う） */}
        <div ref={terminalsContainerRef} className="terminals-container">
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
                isActive={isSplit
                  ? tab.id === activePaneTabId
                  : index === activeIndex}
                fontFamily={appearance.font_family}
                fontSize={appearance.font_size}
              />
              {textBoxVisible && (
                isSplit
                  ? tab.id === activePaneTabId
                  : index === activeIndex
              ) && (
                <TextBoxInput tabId={tab.id || null} />
              )}
            </div>
          ))}
        </div>
      </div>
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
