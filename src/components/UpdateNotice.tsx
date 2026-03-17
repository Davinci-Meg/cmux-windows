import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";

export default function UpdateNotice() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const update = await check();
        if (!cancelled && update?.available) {
          setUpdateVersion(update.version);
        }
      } catch {
        // アップデートチェック失敗は静かに無視
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleUpdate = async () => {
    setInstalling(true);
    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        // インストール後にアプリを再起動するにはrelaunchが必要
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      }
    } catch (err) {
      console.error("Update failed:", err);
      setInstalling(false);
    }
  };

  if (!updateVersion || dismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#313244",
        borderTop: "1px solid #45475a",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        color: "#cdd6f4",
        fontSize: "13px",
        zIndex: 1000,
      }}
    >
      <span style={{ flex: 1 }}>
        v{updateVersion} が利用可能です
      </span>
      <button
        onClick={handleUpdate}
        disabled={installing}
        style={{
          background: "#a6e3a1",
          color: "#1e1e2e",
          border: "none",
          borderRadius: "4px",
          padding: "4px 12px",
          cursor: installing ? "not-allowed" : "pointer",
          fontWeight: "bold",
          fontSize: "13px",
          opacity: installing ? 0.6 : 1,
        }}
      >
        {installing ? "更新中..." : "更新"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        disabled={installing}
        style={{
          background: "transparent",
          color: "#6c7086",
          border: "none",
          cursor: "pointer",
          fontSize: "16px",
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}
