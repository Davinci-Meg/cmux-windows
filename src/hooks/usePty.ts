import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface PtySize {
  cols: number;
  rows: number;
}

export function usePty(tabId: string | null) {
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const createPty = useCallback(
    async (cols: number, rows: number): Promise<string> => {
      const id = await invoke<string>("create_pty", { cols, rows });
      return id;
    },
    []
  );

  const writePty = useCallback(
    async (data: string) => {
      if (!tabId) return;
      await invoke("write_pty", { tabId, data });
    },
    [tabId]
  );

  const resizePty = useCallback(
    async (cols: number, rows: number) => {
      if (!tabId) return;
      await invoke("resize_pty", { tabId, cols, rows });
    },
    [tabId]
  );

  const closePty = useCallback(async () => {
    if (!tabId) return;
    await invoke("close_pty", { tabId });
  }, [tabId]);

  const listenOutput = useCallback(
    (onData: (data: string) => void) => {
      if (!tabId) return;

      // Clean up previous listener
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      listen<string>(`pty-output-${tabId}`, (event) => {
        onData(event.payload);
      }).then((unlisten) => {
        unlistenRef.current = unlisten;
      });
    },
    [tabId]
  );

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [tabId]);

  return { createPty, writePty, resizePty, closePty, listenOutput };
}
