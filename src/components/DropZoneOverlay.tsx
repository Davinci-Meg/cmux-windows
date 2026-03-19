export type DropZone = "left" | "right" | "top" | "bottom" | null;

interface DropZoneOverlayProps {
  targetRect: DOMRect | null;
  activeZone: DropZone;
}

export default function DropZoneOverlay({ targetRect, activeZone }: DropZoneOverlayProps) {
  if (!targetRect) return null;

  return (
    <div
      className="drop-zone-overlay"
      style={{
        top: targetRect.top,
        left: targetRect.left,
        width: targetRect.width,
        height: targetRect.height,
      }}
    >
      <div className={`drop-zone-region left${activeZone === "left" ? " active" : ""}`} />
      <div className={`drop-zone-region right${activeZone === "right" ? " active" : ""}`} />
      <div className={`drop-zone-region top${activeZone === "top" ? " active" : ""}`} />
      <div className={`drop-zone-region bottom${activeZone === "bottom" ? " active" : ""}`} />
    </div>
  );
}
