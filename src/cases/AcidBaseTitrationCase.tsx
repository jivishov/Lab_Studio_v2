import { useMemo, useState } from "react";
import {
  Beaker,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  Download,
  FileText,
  FlaskConical,
  Grid2X2,
  Import,
  Info,
  List,
  Minus,
  MoreVertical,
  Plus,
  RotateCcw,
  Settings,
  Table2,
  Upload,
  User,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type Mode = "student" | "teacher";

interface FlowNode {
  id: string;
  type: "start" | "action" | "checkpoint" | "calculation" | "feedback" | "end";
  title: string;
  detail?: string;
  x: number;
  y: number;
}

const equipment = [
  { id: "beaker", label: "Beaker", sublabel: "250 mL", asset: "/assets/equipment/beaker-250ml.svg" },
  { id: "balance", label: "Balance", sublabel: "0.01 g", asset: "/assets/equipment/analytical-balance.svg" },
  {
    id: "cylinder",
    label: "Graduated Cylinder",
    sublabel: "100 mL",
    asset: "/assets/equipment/graduated-cylinder.svg",
  },
  {
    id: "funnel",
    label: "Funnel + Filter Paper",
    sublabel: "11 cm",
    asset: "/assets/equipment/funnel-stand.svg",
  },
  { id: "watch-glass", label: "Watch Glass", sublabel: "75 mm", asset: "/assets/equipment/watch-glass.svg" },
];

const flowNodes: FlowNode[] = [
  { id: "start", type: "start", title: "Start", x: 260, y: 24 },
  { id: "add-naoh", type: "action", title: "Add NaOH to beaker", detail: "(50.00 mL)", x: 190, y: 94 },
  { id: "stir", type: "action", title: "Stir solution", x: 225, y: 176 },
  { id: "check-volume", type: "checkpoint", title: "Checkpoint 1", detail: "Volume = 50.00 mL +/- 0.20 mL", x: 205, y: 255 },
  { id: "feedback-volume", type: "feedback", title: "Feedback", detail: "Check volume.", x: 430, y: 282 },
  { id: "titrate", type: "action", title: "Titrate with HCl", detail: "(until endpoint)", x: 180, y: 405 },
  { id: "record", type: "action", title: "Record final volume", x: 180, y: 492 },
  { id: "calculate", type: "calculation", title: "Calculate", detail: "Molarity HCl", x: 438, y: 474 },
  { id: "check-ph", type: "checkpoint", title: "Checkpoint 2", detail: "pH at endpoint 6.00 - 8.00", x: 205, y: 610 },
  { id: "feedback-ph", type: "feedback", title: "Feedback", detail: "pH out of range.", x: 450, y: 637 },
  { id: "end", type: "end", title: "End", x: 260, y: 770 },
];

const progress = [
  "Prepare Solution",
  "Titrate Sample",
  "Record Data",
  "Calculate Results",
  "Checkpoint",
  "Conclusion",
];

const feedback = [
  { severity: "success", message: "Balance is level.", time: "10:24 AM" },
  { severity: "info", message: "Good! Add 50.00 mL of NaOH to the beaker.", time: "10:34 AM" },
  { severity: "warn", message: "Check the meniscus at eye level.", time: "10:26 AM" },
];

const notebookRows = [
  ["1", "0.00", "24.85", "24.85", "7.02"],
  ["2", "0.00", "25.10", "25.10", "7.01"],
  ["3", "0.00", "24.95", "24.95", "7.00"],
  ["Average", "--", "--", "24.97", "--"],
];

const connectorPaths = [
  "M300 62 L300 93",
  "M300 144 L300 176",
  "M300 226 L300 254",
  "M360 316 L430 316",
  "M300 372 L300 405",
  "M300 455 L300 492",
  "M342 526 L438 526",
  "M300 542 L300 610",
  "M365 670 L450 670",
  "M300 728 L300 770",
  "M520 316 L565 316 L565 94 L371 94",
  "M535 670 L622 670 L622 405 L362 405",
];

const TitrationSidebar = () => (
  <aside className="titration-sidebar">
    <a className="case-brand" href="#/" aria-label="Lab Studio home">
      <FlaskConical size={23} aria-hidden="true" />
      <strong>Lab Studio</strong>
    </a>
    <nav className="case-nav" aria-label="Case navigation">
      <a href="#/studio">
        <Workflow size={16} aria-hidden="true" /> Studio
      </a>
      <a href="#/labs">
        <FlaskConical size={16} aria-hidden="true" /> Labs
      </a>
      <a href="#/techniques">
        <FileText size={16} aria-hidden="true" /> Techniques
      </a>
    </nav>
    <div className="case-sidebar-footer">
      <a href="#/studio">
        <Settings size={16} aria-hidden="true" /> Settings
      </a>
      <a href="#/">
        <Minus size={16} aria-hidden="true" /> Collapse
      </a>
    </div>
  </aside>
);

const CaseToolbar = ({ mode, setMode }: { mode: Mode; setMode: (mode: Mode) => void }) => (
  <header className="case-toolbar">
    <div className="case-title">
      <FileText size={17} aria-hidden="true" />
      <strong>Acid-Base Titration</strong>
      <ChevronDown size={15} aria-hidden="true" />
      <Cloud size={16} aria-hidden="true" />
      <span>Edited just now</span>
    </div>
    <div className="case-toolbar-actions">
      <button type="button">
        <Upload size={15} aria-hidden="true" /> Import
      </button>
      <button type="button">
        <Download size={15} aria-hidden="true" /> Export
      </button>
      <div className="case-mode">
        <span>Mode:</span>
        <button
          className={mode === "student" ? "is-active" : ""}
          type="button"
          onClick={() => setMode("student")}
        >
          Student
        </button>
        <button
          className={mode === "teacher" ? "is-active" : ""}
          type="button"
          onClick={() => setMode("teacher")}
        >
          Teacher
        </button>
      </div>
      <button type="button">
        <RotateCcw size={15} aria-hidden="true" /> Reset
      </button>
      <button className="icon-button" type="button" aria-label="Help">
        <CircleHelp size={18} aria-hidden="true" />
      </button>
      <button className="avatar-button" type="button" aria-label="User menu">
        TS <ChevronDown size={12} aria-hidden="true" />
      </button>
    </div>
  </header>
);

const EquipmentShelf = () => (
  <section className="case-card equipment-case">
    <div className="case-card-head">
      <h2>Equipment Shelf</h2>
      <Info size={14} aria-hidden="true" />
      <div className="shelf-tools">
        <label>
          <span className="sr-only">Search shelf</span>
          <input placeholder="Search shelf..." />
        </label>
        <button className="icon-button" type="button" aria-label="List view">
          <List size={15} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" aria-label="Grid view">
          <Grid2X2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
    <div className="case-equipment-row">
      {equipment.map((item) => (
        <button className="case-equipment" key={item.id} type="button">
          <img src={item.asset} alt="" aria-hidden="true" />
          <strong>{item.label}</strong>
          <span>{item.sublabel}</span>
        </button>
      ))}
    </div>
  </section>
);

const Workbench = ({ placed, setPlaced }: { placed: number; setPlaced: (placed: number) => void }) => (
  <section className="case-card workbench-case">
    <div className="case-card-head">
      <h2>Workbench</h2>
      <Info size={14} aria-hidden="true" />
      <div className="bench-tools">
        <span>Snap:</span>
        <button className="snap-toggle" type="button" onClick={() => setPlaced(Math.min(5, placed + 1))}>
          On
        </button>
        <button className="icon-button" type="button" aria-label="Fullscreen workbench">
          <Grid2X2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
    <div className="case-workbench-grid" aria-label="Interactive titration workbench">
      {[0, 1, 2, 3, 4].map((slot) => (
        <button className={`drop-slot slot-${slot}`} key={slot} type="button" onClick={() => setPlaced(slot + 1)}>
          <Plus size={18} aria-hidden="true" />
          <span>{slot < placed ? "Placed" : "Drop here"}</span>
        </button>
      ))}
    </div>
  </section>
);

const ProgressFeedback = ({ step, setStep }: { step: number; setStep: (step: number) => void }) => (
  <aside className="student-side">
    <section className="case-card progress-case">
      <ol>
        {progress.map((item, index) => (
          <li className={index === step ? "is-current" : index < step ? "is-done" : ""} key={item}>
            <button type="button" onClick={() => setStep(index)}>
              <span>{index + 1}</span>
              {item}
            </button>
          </li>
        ))}
      </ol>
    </section>
    <section className="case-card feedback-case">
      <div className="case-card-head">
        <h2>Feedback</h2>
      </div>
      {feedback.map((item) => (
        <article className={item.severity} key={item.message}>
          <Check size={15} aria-hidden="true" />
          <p>{item.message}</p>
          <time>{item.time}</time>
        </article>
      ))}
      <button className="clear-feedback" type="button">
        Clear
      </button>
    </section>
  </aside>
);

const Notebook = () => (
  <section className="case-card notebook-case">
    <div className="case-tabs">
      <button className="is-active" type="button">
        Notebook
      </button>
      <button type="button">Results</button>
    </div>
    <div className="notebook-toolbar">
      <button type="button">B</button>
      <button type="button">I</button>
      <button type="button">U</button>
      <button type="button">
        <List size={15} aria-hidden="true" />
      </button>
      <button type="button">
        <Table2 size={15} aria-hidden="true" />
      </button>
      <button type="button">Template</button>
    </div>
    <table>
      <caption>Data Table 1</caption>
      <thead>
        <tr>
          <th>Trial</th>
          <th>Initial Volume NaOH (mL)</th>
          <th>Final Volume NaOH (mL)</th>
          <th>Volume Used (mL)</th>
          <th>pH at Endpoint</th>
        </tr>
      </thead>
      <tbody>
        {notebookRows.map((row, rowIndex) => (
          <tr key={row[0]}>
            {row.map((cell, cellIndex) => (
              <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    <textarea aria-label="Notebook note" placeholder="Add a note..." />
  </section>
);

const StudentPanel = ({ step, setStep }: { step: number; setStep: (step: number) => void }) => {
  const [placed, setPlaced] = useState(0);
  return (
    <section className="student-case">
      <div className="case-section-title teal">
        <User size={15} aria-hidden="true" />
        Student Player
      </div>
      <div className="student-grid-case">
        <div className="student-main">
          <EquipmentShelf />
          <Workbench placed={placed} setPlaced={setPlaced} />
          <Notebook />
        </div>
        <ProgressFeedback step={step} setStep={setStep} />
      </div>
    </section>
  );
};

const FlowNodeView = ({
  node,
  selected,
  onSelect,
}: {
  node: FlowNode;
  selected: boolean;
  onSelect: (id: string) => void;
}) => (
  <button
    className={`flow-node ${node.type} ${selected ? "is-selected" : ""}`}
    style={{ left: node.x, top: node.y }}
    type="button"
    onClick={() => onSelect(node.id)}
  >
    {node.type === "checkpoint" ? <span className="diamond-mark" /> : null}
    {node.type === "calculation" ? <span className="function-mark">fx</span> : null}
    {node.type === "feedback" ? <span className="feedback-mark">!</span> : null}
    <strong>{node.title}</strong>
    {node.detail ? <span>{node.detail}</span> : null}
    {node.type === "action" ? <MoreVertical size={14} aria-hidden="true" /> : null}
  </button>
);

const ProcessMap = ({
  selectedNodeId,
  setSelectedNodeId,
}: {
  selectedNodeId: string;
  setSelectedNodeId: (id: string) => void;
}) => (
  <section className="process-case">
    <div className="case-card-head process-head">
      <h2>Process Map</h2>
      <div className="process-tools">
        <button className="icon-button" type="button" aria-label="Zoom out">
          <ZoomOut size={14} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" aria-label="Zoom in">
          <ZoomIn size={14} aria-hidden="true" />
        </button>
        <button type="button">100%</button>
      </div>
    </div>
    <div className="process-canvas">
      <svg className="flow-connectors" viewBox="0 0 700 850" aria-hidden="true">
        {connectorPaths.map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
      <span className="branch-tag tag-no one">No</span>
      <span className="branch-tag tag-yes one">Yes</span>
      <span className="branch-tag tag-no two">No</span>
      <span className="branch-tag tag-yes two">Yes</span>
      {flowNodes.map((node) => (
        <FlowNodeView
          key={node.id}
          node={node}
          selected={node.id === selectedNodeId}
          onSelect={setSelectedNodeId}
        />
      ))}
    </div>
    <div className="add-node-bar">
      <span>Add Node</span>
      <button type="button">
        <Beaker size={15} aria-hidden="true" /> Action
      </button>
      <button type="button">
        <span className="mini-diamond" /> Checkpoint
      </button>
      <button type="button">
        <span className="mini-fx">fx</span> Calculation
      </button>
      <button type="button">
        <span className="mini-warn">!</span> Feedback
      </button>
      <button type="button">
        <FileText size={15} aria-hidden="true" /> Note
      </button>
    </div>
  </section>
);

const Inspector = ({ selectedNode }: { selectedNode: FlowNode }) => (
  <aside className="inspector-case">
    <div className="inspector-tabs">
      <button className="is-active" type="button">
        Inspector
      </button>
      <button type="button">Properties</button>
    </div>
    <div className="inspector-block">
      <label>Node</label>
      <button className="node-select" type="button">
        <Beaker size={20} aria-hidden="true" />
        <span>
          <strong>{selectedNode.id === "add-naoh" ? "Add NaOH to beaker (50.00 mL)" : selectedNode.title}</strong>
          <small>{selectedNode.type}</small>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
    </div>
    <div className="inspector-block">
      <label>ID</label>
      <input value={selectedNode.id === "add-naoh" ? "step_add_naoh" : selectedNode.id} readOnly />
    </div>
    <div className="inspector-block">
      <label>Label</label>
      <div className="input-with-token">
        <input value={selectedNode.title === "Add NaOH to beaker" ? "Add NaOH to beaker (50.00 mL)" : selectedNode.title} readOnly />
        <button type="button">Aa</button>
      </div>
    </div>
    <div className="inspector-block">
      <label>Instructions</label>
      <div className="rich-editor">
        <div>
          <button type="button">B</button>
          <button type="button">I</button>
          <button type="button">
            <List size={14} aria-hidden="true" />
          </button>
        </div>
        <textarea
          value={
            "Use the graduated cylinder to measure 50.00 mL of 0.100 M NaOH and add it to the beaker."
          }
          readOnly
        />
      </div>
    </div>
    <div className="inspector-block">
      <label>Requirements</label>
      <select defaultValue="all">
        <option value="all">All must be true</option>
      </select>
      <article className="requirement-card">
        <strong>Volume in Beaker</strong>
        <span>&gt;= 49.80 mL and &lt;= 50.20 mL</span>
        <MoreVertical size={14} aria-hidden="true" />
      </article>
      <button className="add-requirement" type="button">
        <Plus size={14} aria-hidden="true" /> Add requirement
      </button>
    </div>
    <div className="inspector-block">
      <label>Hint</label>
      <input value="Check the meniscus at eye level." readOnly />
    </div>
    <div className="inspector-block">
      <label>Points</label>
      <div className="points-row">
        <input value="10" readOnly />
        <span>Optional</span>
      </div>
    </div>
    <details className="advanced-row">
      <summary>Advanced</summary>
    </details>
    <section className="validation-card">
      <div>
        <strong>Validation</strong>
        <p>
          <Check size={15} aria-hidden="true" /> No issues
        </p>
      </div>
      <span>All paths reach an end node.</span>
    </section>
  </aside>
);

const TeacherPanel = ({
  selectedNodeId,
  setSelectedNodeId,
}: {
  selectedNodeId: string;
  setSelectedNodeId: (id: string) => void;
}) => {
  const selectedNode = useMemo(
    () => flowNodes.find((node) => node.id === selectedNodeId) ?? flowNodes[1],
    [selectedNodeId],
  );
  return (
    <section className="teacher-case">
      <div className="case-section-title amber">
        <Workflow size={15} aria-hidden="true" />
        Lab Design Studio
      </div>
      <div className="teacher-grid-case">
        <ProcessMap selectedNodeId={selectedNodeId} setSelectedNodeId={setSelectedNodeId} />
        <Inspector selectedNode={selectedNode} />
      </div>
    </section>
  );
};

export const AcidBaseTitrationCase = () => {
  const [mode, setMode] = useState<Mode>("student");
  const [step, setStep] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState("add-naoh");

  return (
    <main className="titration-case-shell">
      <TitrationSidebar />
      <div className="titration-case-main">
        <CaseToolbar mode={mode} setMode={setMode} />
        <div className="titration-case-workspace">
          <StudentPanel step={step} setStep={setStep} />
          <TeacherPanel selectedNodeId={selectedNodeId} setSelectedNodeId={setSelectedNodeId} />
        </div>
      </div>
    </main>
  );
};
