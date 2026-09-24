/** Stroke icons on a 24 px grid, 1.7 px stroke, round caps and joins (handoff §3.6). */
const PATHS: Record<string, string> = {
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9",
  "chevron-down": "m6 9 6 6 6-6",
  "chevron-up": "m6 15 6-6 6 6",
  "arrow-right": "M4 12h15M14 7l5 5-5 5",
  play: "M7 5v14l11-7z",
  tray: "M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  examine: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5l5 5M10.5 7.5v6M7.5 10.5h6",
  hand: "M8 13V6a1.5 1.5 0 0 1 3 0v6M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 15l-1-3a1.5 1.5 0 0 1 2.7-1.2L8 13",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  reset: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  book: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  x: "M6 6l12 12M18 6 6 18",
  check: "m5 12 5 5 9-10",
  pencil: "M15 4l5 5L9 20H4v-5zM13 6l5 5",
  clip: "M5 5h14v16H5zM9 3h6v4H9zM8.5 12h7M8.5 16h5",
  beaker: "M6 3h12M7 3v15a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V3M7 12h10",
  chip: "M6 6h12v12H6zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3",
  equals: "M5 9h14M5 15h14",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  warn: "M12 4 2.5 20h19zM12 10v4M12 17h.01",
};

export const Icon = ({ name, className, size = 16 }: { name: keyof typeof PATHS | string; className?: string; size?: number }) => (
  <svg
    className={["s3d-icon", className].filter(Boolean).join(" ")}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={PATHS[name] ?? ""} fill={name === "play" ? "currentColor" : "none"} />
  </svg>
);
