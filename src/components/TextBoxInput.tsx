import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ChangeEvent } from "react";
import { usePty } from "../hooks/usePty";

interface TextBoxInputProps {
  tabId: string | null;
  enterToSend?: boolean;
}


const SendIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export default function TextBoxInput({ tabId, enterToSend = true }: TextBoxInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { writePty } = usePty(tabId);

  const sendText = useCallback(async () => {
    if (!tabId) return;

    // Send text followed by carriage return (empty Enter is valid)
    await writePty(value + "\r");

    setValue("");
  }, [tabId, value, writePty]);

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!tabId) return;

      // Always forward these regardless of content
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        await writePty("\x03");
        return;
      }
      if (e.ctrlKey && e.key === "d") {
        e.preventDefault();
        await writePty("\x04");
        return;
      }
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        await writePty("\x1a");
        return;
      }

      // Escape: send to terminal
      if (e.key === "Escape") {
        e.preventDefault();
        await writePty("\x1b");
        return;
      }

      // Enter behavior
      if (e.key === "Enter") {
        if (enterToSend && !e.shiftKey) {
          e.preventDefault();
          await sendText();
          return;
        }
        // Shift+Enter: let default newline insertion happen
      }

      // Empty-state passthrough
      if (!value) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          await writePty("\x1b[A");
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          await writePty("\x1b[B");
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          await writePty("\t");
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          await writePty("\x7f");
          return;
        }
      }
    },
    [tabId, value, enterToSend, sendText, writePty]
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = 20; // approximate line height
    const minHeight = lineHeight * 2;
    const maxHeight = lineHeight * 6;
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  return (
    <div
      style={{
        padding: "8px 12px",
        background: "#1e1e2e",
        borderTop: "1px solid rgba(205, 214, 244, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          border: `1px solid rgba(205, 214, 244, ${focused ? 0.45 : 0.25})`,
          borderRadius: "6px",
          background: "#252536",
          padding: "8px 12px",
          transition: "border-color 0.15s ease",
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Shift+Enter for newline"
          rows={2}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#cdd6f4",
            fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
            fontSize: "15px",
            lineHeight: "20px",
            resize: "none",
            padding: 0,
            margin: 0,
          }}
        />
        <button
          onClick={sendText}
          disabled={!tabId}
          style={{
            background: "none",
            border: "none",
            color: tabId ? "#89b4fa" : "#585b70",
            cursor: tabId ? "pointer" : "default",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "color 0.15s ease",
          }}
          title="送信"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
