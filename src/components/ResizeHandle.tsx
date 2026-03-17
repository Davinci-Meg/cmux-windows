import { useCallback, useRef } from "react";

interface ResizeHandleProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
}

export default function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const startPosRef = useRef(0);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const isHorizontal = direction === "horizontal";
      startPosRef.current = isHorizontal ? e.clientX : e.clientY;

      document.documentElement.classList.add("resizing");

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentPos = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
        const delta = currentPos - startPosRef.current;
        if (delta !== 0) {
          onResizeRef.current(delta);
          startPosRef.current = currentPos;
        }
      };

      const handleMouseUp = () => {
        document.documentElement.classList.remove("resizing");
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [direction]
  );

  return (
    <div
      className={`resize-handle ${direction}`}
      onMouseDown={handleMouseDown}
    />
  );
}
