import type { AppNotification } from "../types/notification";

interface NotificationPanelProps {
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export default function NotificationPanel({
  notifications,
  onMarkAllRead,
  onClearAll,
  onClose,
}: NotificationPanelProps) {
  return (
    <div className="notification-panel">
      <div className="notification-panel-header">
        <h3>通知</h3>
        <button className="notification-panel-close" onClick={onClose}>
          &times;
        </button>
      </div>
      <div className="notification-panel-actions">
        <button className="notification-panel-action" onClick={onMarkAllRead}>
          全て既読にする
        </button>
        <button className="notification-panel-action" onClick={onClearAll}>
          クリア
        </button>
      </div>
      <div className="notification-panel-list">
        {notifications.length === 0 ? (
          <div className="notification-panel-empty">通知はありません</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`notification-item${n.read ? "" : " unread"}`}>
              <div className="notification-item-header">
                {!n.read && <span className="notification-unread-dot" />}
                <span className="notification-item-title">{n.title}</span>
                <span className="notification-item-source">{n.source}</span>
              </div>
              <div className="notification-item-body">{n.body}</div>
              <div className="notification-item-time">{formatTime(n.timestamp)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
