import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface TerminalProps {
  tabId: string | null;
  onTabIdCreated: (id: string) => void;
  onTitleChange?: (title: string) => void;
  isActive: boolean;
  fontFamily?: string;
  fontSize?: number;
}

export default function Terminal({ tabId, onTabIdCreated, onTitleChange, isActive, fontFamily, fontSize }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);
  const tabIdRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);

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
        selectionBackground: "#585b7066",
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
    term.open(containerRef.current);
    fitAddon.fit();
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
            term.write(event.payload);
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
      } catch (err) {
        term.write(`\r\nError: ${err}\r\n`);
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

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "hidden",
        display: isActive ? "block" : "none",
      }}
    />
  );
}
