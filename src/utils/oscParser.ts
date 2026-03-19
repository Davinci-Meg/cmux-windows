export interface OscNotification {
  title: string;
  body: string;
}

/**
 * PTY出力からOSC 9/777エスケープシーケンスを抽出し、通知に変換する。
 * OSC 9: \x1b]9;text(\x07|\x1b\\)
 * OSC 777: \x1b]777;notify;title;body(\x07|\x1b\\)
 */
export function extractOscNotifications(data: string): {
  cleaned: string;
  notifications: OscNotification[];
} {
  const notifications: OscNotification[] = [];

  // OSC 777: notify;title;body
  // OSC 9: text (title = "Terminal", body = text)
  // ST (String Terminator) は BEL (\x07) または ESC \\ (\x1b\\)
  const oscPattern = /\x1b\](?:777;notify;([^\x07\x1b]*?);([^\x07\x1b]*?)|9;([^\x07\x1b]*?))(?:\x07|\x1b\\)/g;

  const cleaned = data.replace(oscPattern, (_match, title777, body777, text9) => {
    if (title777 !== undefined) {
      notifications.push({ title: title777, body: body777 });
    } else if (text9 !== undefined) {
      notifications.push({ title: "Terminal", body: text9 });
    }
    return "";
  });

  return { cleaned, notifications };
}
