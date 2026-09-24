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
  // Studio 3D (the approved mock-up symbol set)
  search: "M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm5 11.5 4 4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  move: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3",
  seat: "M9 3h6v9H9zM5 14h14v6H5zM12 12v2",
  pour: "M4 7l6-3 4 7-6 3zM13 10c2 2 3 4 3 6M13 16h7v5h-7z",
  gauge: "M4 16a8 8 0 1 1 16 0M12 16l4-5M3 20h18",
  calc: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2",
  cards: "M6 8h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM7 5h11a2 2 0 0 1 2 2v10",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  split: "M4 12h6l4-6h6M10 12l4 6h6M17 3l3 3-3 3M17 15l3 3-3 3",
  note: "M5 4h14v11l-5 5H5zM14 20v-5h5M8 9h8M8 13h4",
  undo: "M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3",
  redo: "m15 7 5 5-5 5M20 12H9a5 5 0 0 0 0 10h3",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  grid: "M4 4h16v16H4zM4 12h16M12 4v16",
  layout: "M4 4h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 14h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM10 7h4v10",
  map: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM13 11h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z",
  details: "M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 9h8M8 13h8M8 17h4",
  fit: "M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5M9 9h6v6H9z",
  retry: "M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4",
  lock: "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  cursor: "M5 3l14 7-6 2-2 6z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  download: "M12 4v12M7 11l5 5 5-5M4 16v4h16v-4",
  cube: "M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9",
  chev: "m6 9 6 6 6-6",
  up: "m6 15 6-6 6 6",
  arrow: "M4 12h15M14 7l5 5-5 5",
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
