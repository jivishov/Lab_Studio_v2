import type { RuntimeState } from "../domain/types";

interface NotebookPanelProps {
  state: RuntimeState;
}

export const NotebookPanel = ({ state }: NotebookPanelProps) => (
  <section className="notebook-panel">
    <div className="panel-heading">
      <h2>Notebook</h2>
      <span>{state.notebook.length} entries</span>
    </div>
    {state.notebook.length === 0 ? (
      <p className="empty-state">Measurements, observations, and calculations appear here.</p>
    ) : (
      <ul className="notebook-list">
        {state.notebook.map((entry) => (
          <li key={entry.id}>
            <strong>{entry.label}</strong>
            <span>{entry.value}</span>
          </li>
        ))}
      </ul>
    )}
  </section>
);
