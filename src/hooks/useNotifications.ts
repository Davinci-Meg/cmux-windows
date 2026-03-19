import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppNotification } from "../types/notification";

const MAX_NOTIFICATIONS = 100;
const FLASH_DURATION_MS = 3000;

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  unreadByTab: Map<string, number>;
  flashingTabIds: Set<string>;
  dispatch: (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markRead: (tabId: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

let notificationIdCounter = 0;

export function useNotifications(notifyAgentDone: boolean): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [flashingTabIds, setFlashingTabIds] = useState<Set<string>>(new Set());
  const notifyAgentDoneRef = useRef(notifyAgentDone);
  notifyAgentDoneRef.current = notifyAgentDone;

  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dispatch = useCallback(
    (partial: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      notificationIdCounter += 1;
      const notification: AppNotification = {
        ...partial,
        id: `notif-${notificationIdCounter}-${Date.now()}`,
        timestamp: Date.now(),
        read: false,
      };

      // 通知をstateに追加（最大100件）
      setNotifications((prev) => {
        const next = [notification, ...prev];
        return next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next;
      });

      // タブボーダーフラッシュ（F3）
      const tabId = partial.tabId;
      setFlashingTabIds((prev) => {
        const next = new Set(prev);
        next.add(tabId);
        return next;
      });

      // 前のタイマーをクリアしてから新しいタイマーを設定
      const existingTimer = flashTimers.current.get(tabId);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        setFlashingTabIds((prev) => {
          const next = new Set(prev);
          next.delete(tabId);
          return next;
        });
        flashTimers.current.delete(tabId);
      }, FLASH_DURATION_MS);
      flashTimers.current.set(tabId, timer);

      // OS Notification API（既存ロジック）
      if (notifyAgentDoneRef.current && "Notification" in window && Notification.permission === "granted") {
        new Notification(notification.title, { body: notification.body });
      }

      // F7: カスタム通知コマンド実行
      invoke("run_notification_command", {
        title: notification.title,
        body: notification.body,
      }).catch(() => {});
    },
    []
  );

  const markRead = useCallback((tabId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.tabId === tabId && !n.read ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // 未読数の計算
  const unreadCount = notifications.filter((n) => !n.read).length;

  const unreadByTab = new Map<string, number>();
  for (const n of notifications) {
    if (!n.read) {
      unreadByTab.set(n.tabId, (unreadByTab.get(n.tabId) || 0) + 1);
    }
  }

  return {
    notifications,
    unreadCount,
    unreadByTab,
    flashingTabIds,
    dispatch,
    markRead,
    markAllRead,
    clearAll,
  };
}
