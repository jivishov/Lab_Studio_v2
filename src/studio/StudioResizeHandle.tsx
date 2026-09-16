import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

interface StudioResizeHandleProps {
  ariaValueText?: string;
  className?: string;
  defaultValue: number;
  direction?: 1 | -1;
  getPixelsPerUnit?: () => number;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  orientation: "horizontal" | "vertical";
  step?: number;
  value: number;
}

interface ResizeSession {
  origin: number;
  pixelsPerUnit: number;
  pointerId: number;
  startValue: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const StudioResizeHandle = ({
  ariaValueText,
  className = "",
  defaultValue,
  direction = 1,
  getPixelsPerUnit,
  label,
  max,
  min,
  onChange,
  orientation,
  step = 8,
  value,
}: StudioResizeHandleProps) => {
  const sessionRef = useRef<ResizeSession | null>(null);
  const coordinate = (event: ReactPointerEvent<HTMLDivElement>) =>
    orientation === "vertical" ? event.clientX : event.clientY;

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = {
      origin: coordinate(event),
      pixelsPerUnit: Math.max(0.01, getPixelsPerUnit?.() ?? 1),
      pointerId: event.pointerId,
      startValue: value,
    };
  };

  const continueResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const delta = ((coordinate(event) - session.origin) / session.pixelsPerUnit) * direction;
    onChange(clamp(session.startValue + delta, min, max));
  };

  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sessionRef.current?.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const adjustWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const decreaseKey = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
    const increaseKey = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
    if (event.key === decreaseKey) {
      event.preventDefault();
      onChange(clamp(value - step * direction, min, max));
    } else if (event.key === increaseKey) {
      event.preventDefault();
      onChange(clamp(value + step * direction, min, max));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(min);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(max);
    }
  };

  return (
    <div
      className={`studio-resize-handle is-${orientation} ${className}`.trim()}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemax={Math.round(max)}
      aria-valuemin={Math.round(min)}
      aria-valuenow={Math.round(value)}
      aria-valuetext={ariaValueText}
      tabIndex={0}
      title={`${label}. Drag to resize; use arrow keys, Home, or End.`}
      onDoubleClick={() => onChange(clamp(defaultValue, min, max))}
      onKeyDown={adjustWithKeyboard}
      onLostPointerCapture={() => {
        sessionRef.current = null;
      }}
      onPointerCancel={stopResize}
      onPointerDown={startResize}
      onPointerMove={continueResize}
      onPointerUp={stopResize}
    >
      <span aria-hidden="true" />
    </div>
  );
};
