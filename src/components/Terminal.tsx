import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import { extractOscNotifications } from "../utils/oscParser";

interface TerminalProps {
  tabId: string | null;
  onTabIdCreated: (id: string) => void;
  onTitleChange?: (title: string) => void;
  onOscNotification?: (title: string, body: string) => void;
  isActive: boolean;
  // 分割ビューで非アクティブペインでも表示を維持するフラグ
  isVisible?: boolean;
  fontFamily?: string;
  fontSize?: number;
}

export default function Terminal({ tabId, onTabIdCreated, onTitleChange, onOscNotification, isActive, isVisible, fontFamily, fontSize }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const initializedRef = useRef(false);
  const tabIdRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    tabIdRef.current = tabId;
  }, [tabId]);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const term = new XTerm({
      fontFamily: fontFamily || "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
      fontSize: fontSize || 14,
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#f5e0dc",
        selectionBackground: "#89b4fa80",
        selectionForeground: "#ffffff",
        black: "#45475a",
        red: "#f38ba8",
        green: "#a6e3a1",
        yellow: "#f9e2af",
        blue: "#89b4fa",
        magenta: "#f5c2e7",
        cyan: "#94e2d5",
        white: "#bac2de",
        brightBlack: "#585b70",
        brightRed: "#f38ba8",
        brightGreen: "#a6e3a1",
        brightYellow: "#f9e2af",
        brightBlue: "#89b4fa",
        brightMagenta: "#f5c2e7",
        brightCyan: "#94e2d5",
        brightWhite: "#a6adc8",
      },
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      open(uri).catch(() => {});
    });
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    // WebGLレンダラーで描画パフォーマンスを向上
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
      webglAddonRef.current = webglAddon;
      // WebGL コンテキストロスト時にCanvasへフォールバック
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
        webglAddonRef.current = null;
      });
      console.log("WebGL renderer initialized");
    } catch {
      console.log("WebGL not available, using Canvas renderer");
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const cols = term.cols;
    const rows = term.rows;

    (async () => {
      try {
        const id = await invoke<string>("create_pty", { cols, rows });
        tabIdRef.current = id;

        unlistenOutputRef.current = await listen<string>(
          `pty-output-${id}`,
          (event) => {
            const { cleaned, notifications } = extractOscNotifications(event.payload);
            if (cleaned) term.write(cleaned);
            for (const n of notifications) {
              if (onOscNotification) onOscNotification(n.title, n.body);
            }
          }
        );
        unlistenExitRef.current = await listen(
          `pty-exit-${id}`,
          () => {
            term.write("\r\n[Process exited]\r\n");
          }
        );

        await invoke("start_pty", { tabId: id });
        onTabIdCreated(id);
        setError(null);
      } catch (err) {
        setError(String(err));
      }
    })();

    const titleDisposable = term.onTitleChange((title) => {
      if (onTitleChange) onTitleChange(title);
    });

    const dataDisposable = term.onData((data) => {
      const currentId = tabIdRef.current;
      if (currentId) {
        invoke("write_pty", { tabId: currentId, data });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });
    resizeObserver.observe(containerRef.current);

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      const currentId = tabIdRef.current;
      if (currentId) {
        invoke("resize_pty", { tabId: currentId, cols, rows });
      }
    });

    return () => {
      titleDisposable.dispose();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      if (unlistenOutputRef.current) unlistenOutputRef.current();
      if (unlistenExitRef.current) unlistenExitRef.current();
      if (webglAddonRef.current) {
        webglAddonRef.current.dispose();
        webglAddonRef.current = null;
      }
      // PTYセッションを解放（アプリ終了・タブ削除時）
      const id = tabIdRef.current;
      if (id) {
        invoke("close_pty", { tabId: id }).catch(() => {});
      }
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 0);
    }
  }, [isActive]);

  // 分割ビューで表示されたタイミングでfitする
  useEffect(() => {
    if (isVisible && !isActive && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 0);
    }
  }, [isVisible, isActive]);

  const handleRetry = useCallback(async () => {
    const term = xtermRef.current;
    if (!term) return;
    setRetrying(true);
    setError(null);

    // 前のリスナーをクリーンアップ
    if (unlistenOutputRef.current) unlistenOutputRef.current();
    if (unlistenExitRef.current) unlistenExitRef.current();

    try {
      const cols = term.cols;
      const rows = term.rows;
      const id = await invoke<string>("create_pty", { cols, rows });
      tabIdRef.current = id;

      unlistenOutputRef.current = await listen<string>(
        `pty-output-${id}`,
        (event) => {
          const { cleaned, notifications } = extractOscNotifications(event.payload);
          if (cleaned) term.write(cleaned);
          for (const n of notifications) {
            if (onOscNotification) onOscNotification(n.title, n.body);
          }
        }
      );
      unlistenExitRef.current = await listen(
        `pty-exit-${id}`,
        () => {
          term.write("\r\n[Process exited]\r\n");
        }
      );

      await invoke("start_pty", { tabId: id });
      onTabIdCreated(id);
      term.clear();
    } catch (err) {
      setError(String(err));
    } finally {
      setRetrying(false);
    }
  }, [onTabIdCreated]);

  return (
    <div
      style={{
        flex: 1,
        overflow: "hidden",
        display: (isActive || isVisible) ? "flex" : "none",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "hidden",
        }}
      />
      {error && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#1e1e2e",
            borderTop: "1px solid #f38ba8",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#cdd6f4",
            fontSize: "13px",
          }}
        >
          <span style={{ color: "#f38ba8", fontWeight: "bold" }}>PTY Error:</span>
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={handleRetry}
            disabled={retrying}
            style={{
              background: "#89b4fa",
              color: "#1e1e2e",
              border: "none",
              borderRadius: "4px",
              padding: "4px 12px",
              cursor: retrying ? "not-allowed" : "pointer",
              fontWeight: "bold",
              fontSize: "13px",
              opacity: retrying ? 0.6 : 1,
            }}
          >
            {retrying ? "接続中..." : "リトライ"}
          </button>
        </div>
      )}
    </div>
  );
}
