import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Terminal from "./components/Terminal";
import TextBoxInput from "./components/TextBoxInput";
import Sidebar, { type Tab, type TabStatus } from "./components/Sidebar";
import SettingsModal from "./components/SettingsModal";
import { matchShortcut } from "./shortcuts";
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

let tabCounter = 0;

function createTab(): Tab {
  tabCounter += 1;
  return {
    id: "",
    name: `${tabCounter}`,
    status: "idle",
  };
}

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

  const handleTabIdCreated = useCallback(
    (index: number, id: string) => {
      setTabs((prev) =>
        prev.map((tab, i) => (i === index ? { ...tab, id } : tab))
      );
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

  const handleTabSelect = useCallback(
    (id: string) => {
      const index = tabs.findIndex((t) => t.id === id);
      if (index >= 0) setActiveIndex(index);
    },
    [tabs]
  );

  const handleNewTab = useCallback(() => {
    const newTab = createTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveIndex(tabs.length);
  }, [tabs.length]);

  const handleCloseTab = useCallback(
    (id: string) => {
      // PTYセッションを解放
      invoke("close_pty", { tabId: id }).catch(() => {});

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
    [tabs]
  );

  const handleReorderTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTabs((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
      // activeIndexも追従
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 設定モーダルが開いている間はショートカット無効化（Escapeは別途ハンドル）
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
        case "close-tab":
          if (activeTab?.id && tabs.length > 1) {
            handleCloseTab(activeTab.id);
          }
          break;
        case "next-tab":
          setActiveIndex((prev) => (prev + 1) % tabs.length);
          break;
        case "prev-tab":
          setActiveIndex((prev) => (prev - 1 + tabs.length) % tabs.length);
          break;
        case "open-settings":
          setSettingsOpen(true);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen, tabs, activeTab, handleNewTab, handleCloseTab]);

  return (
    <div className="app">
      <Sidebar
        tabs={tabs.filter((t) => t.id !== "")}
        activeTabId={activeTab?.id || null}
        onTabSelect={handleTabSelect}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        onReorderTabs={handleReorderTabs}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="main-area">
        {tabs.map((tab, index) => (
          <div
            key={index}
            className="terminal-container"
            style={{ display: index === activeIndex ? "flex" : "none" }}
          >
            <Terminal
              tabId={tab.id || null}
              onTabIdCreated={(id) => handleTabIdCreated(index, id)}
              onTitleChange={(title) => handleTitleChange(index, title)}
              isActive={index === activeIndex}
              fontFamily={appearance.font_family}
              fontSize={appearance.font_size}
            />
            {textBoxVisible && <TextBoxInput tabId={tab.id || null} />}
          </div>
        ))}
      </div>
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onAppearanceChange={handleAppearanceChange}
          onNotificationChange={setNotifyAgentDone}
        />
      )}
    </div>
  );
}
