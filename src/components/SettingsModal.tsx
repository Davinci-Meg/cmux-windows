import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SHORTCUTS } from "../shortcuts";

interface Settings {
  shell: { path: string };
  appearance: { theme: string; font_family: string; font_size: number; color_scheme: string };
  text_box: { enabled: boolean; enter_to_send: boolean; escape_behavior: string };
  sidebar: { visible: boolean; width: number };
  window: { width: number; height: number; start_maximized: boolean };
}

interface SettingsModalProps {
  onClose: () => void;
  onAppearanceChange: (fontFamily: string, fontSize: number) => void;
}

export default function SettingsModal({ onClose, onAppearanceChange }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<Settings>("get_settings")
      .then(setSettings)
      .catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await invoke("update_settings", { settings });
      onAppearanceChange(settings.appearance.font_family, settings.appearance.font_size);
      onClose();
    } catch {
      // save error — keep modal open
    } finally {
      setSaving(false);
    }
  }, [settings, onClose, onAppearanceChange]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains("settings-backdrop")) {
        onClose();
      }
    },
    [onClose]
  );

  if (!settings) return null;

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2>設定</h2>
          <button className="settings-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="settings-body">
          {/* Shell */}
          <section className="settings-section">
            <h3>シェル</h3>
            <label className="settings-field">
              <span>パス</span>
              <input
                type="text"
                value={settings.shell.path}
                onChange={(e) =>
                  setSettings({ ...settings, shell: { ...settings.shell, path: e.target.value } })
                }
                placeholder="default"
              />
            </label>
          </section>

          {/* Appearance */}
          <section className="settings-section">
            <h3>外観</h3>
            <label className="settings-field">
              <span>フォント</span>
              <input
                type="text"
                value={settings.appearance.font_family}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    appearance: { ...settings.appearance, font_family: e.target.value },
                  })
                }
              />
            </label>
            <label className="settings-field">
              <span>フォントサイズ</span>
              <input
                type="number"
                min={8}
                max={32}
                value={settings.appearance.font_size}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    appearance: { ...settings.appearance, font_size: Number(e.target.value) },
                  })
                }
              />
            </label>
          </section>

          {/* TextBox */}
          <section className="settings-section">
            <h3>TextBox</h3>
            <label className="settings-field checkbox">
              <input
                type="checkbox"
                checked={settings.text_box.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    text_box: { ...settings.text_box, enabled: e.target.checked },
                  })
                }
              />
              <span>TextBoxを有効にする</span>
            </label>
            <label className="settings-field checkbox">
              <input
                type="checkbox"
                checked={settings.text_box.enter_to_send}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    text_box: { ...settings.text_box, enter_to_send: e.target.checked },
                  })
                }
              />
              <span>Enterで送信</span>
            </label>
          </section>

          {/* Keyboard shortcuts (read-only) */}
          <section className="settings-section">
            <h3>キーボードショートカット</h3>
            <div className="shortcuts-list">
              {SHORTCUTS.filter((s, i, arr) =>
                // Deduplicate actions (show first binding only)
                arr.findIndex((x) => x.action === s.action) === i
              ).map((s) => (
                <div key={s.action} className="shortcut-row">
                  <span className="shortcut-label">{actionLabel(s.action)}</span>
                  <kbd>{s.label}</kbd>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <button className="settings-btn cancel" onClick={onClose}>
            キャンセル
          </button>
          <button className="settings-btn save" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case "toggle-textbox": return "TextBox表示切替";
    case "new-tab": return "新しいタブ";
    case "close-tab": return "タブを閉じる";
    case "next-tab": return "次のタブ";
    case "prev-tab": return "前のタブ";
    case "open-settings": return "設定を開く";
    default: return action;
  }
}
