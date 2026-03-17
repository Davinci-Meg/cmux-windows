export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  label: string;
  action: string;
}

export const SHORTCUTS: Shortcut[] = [
  { key: "t", ctrl: true, alt: true, label: "Ctrl+Alt+T", action: "toggle-textbox" },
  { key: "t", ctrl: true, shift: true, label: "Ctrl+Shift+T", action: "new-tab" },
  { key: "w", ctrl: true, shift: true, label: "Ctrl+Shift+W", action: "close-tab" },
  { key: "Tab", ctrl: true, label: "Ctrl+Tab", action: "next-tab" },
  { key: "Tab", ctrl: true, shift: true, label: "Ctrl+Shift+Tab", action: "prev-tab" },
  { key: "PageDown", ctrl: true, label: "Ctrl+PageDown", action: "next-tab" },
  { key: "PageUp", ctrl: true, label: "Ctrl+PageUp", action: "prev-tab" },
  { key: ",", ctrl: true, label: "Ctrl+,", action: "open-settings" },
  { key: "\\", ctrl: true, label: "Ctrl+\\", action: "split-horizontal" },
  { key: "-", ctrl: true, label: "Ctrl+-", action: "split-vertical" },
  { key: "]", ctrl: true, label: "Ctrl+]", action: "next-pane" },
  { key: "[", ctrl: true, label: "Ctrl+[", action: "prev-pane" },
];

export function matchShortcut(e: KeyboardEvent): string | null {
  for (const s of SHORTCUTS) {
    if (
      e.key.toLowerCase() === s.key.toLowerCase() &&
      !!e.ctrlKey === !!s.ctrl &&
      !!e.shiftKey === !!s.shift &&
      !!e.altKey === !!s.alt
    ) {
      return s.action;
    }
  }
  return null;
}
