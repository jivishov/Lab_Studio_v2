import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { demoLab } from "../../domain/fixtures";
import { ProcessOutline } from "../ProcessOutline";
import { StudioCommandHeader } from "../StudioCommandHeader";
import { TeacherStudio } from "../TeacherStudio";

describe("Process stage shell", () => {
  it("opens the selected start step editor on the initial Process render", () => {
    window.localStorage.clear();
    render(<TeacherStudio />);

    const editor = screen.getByLabelText("Selected step editor");
    expect(editor).toBeInTheDocument();
    expect(within(editor).getByText(/editing step 1 of/i)).toBeInTheDocument();
    expect(within(editor).getByRole("heading", { name: demoLab.process.nodes[0].title })).toBeInTheDocument();
  });

  it("keeps a persistent collapsed dock and restores the same inspector tab and focus", async () => {
    window.localStorage.clear();
    render(<TeacherStudio />);

    const editor = screen.getByLabelText("Selected step editor");
    const interactionTab = within(editor).getByRole("tab", { name: "Interaction" });
    fireEvent.click(interactionTab);
    expect(interactionTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(within(editor).getByRole("button", { name: "Collapse step editor" }));

    const collapsedDock = screen.getByLabelText("Selected step editor");
    expect(within(collapsedDock).getByRole("heading", { name: demoLab.process.nodes[0].title })).toBeInTheDocument();
    const expandButton = within(collapsedDock).getByRole("button", { name: "Expand editor" });
    expect(screen.getByRole("button", { name: `${demoLab.process.nodes[0].title} Start step` })).toHaveAttribute("aria-current", "step");
    expect(within(collapsedDock).queryByRole("tab", { name: "Interaction" })).not.toBeInTheDocument();
    await waitFor(() => expect(expandButton).toHaveFocus());

    fireEvent.click(expandButton);

    const restoredTab = within(screen.getByLabelText("Selected step editor")).getByRole("tab", { name: "Interaction" });
    expect(restoredTab).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(restoredTab).toHaveFocus());
  });

  it("keeps stage navigation session-scoped and exposes secondary commands through More", () => {
    const onStageChange = vi.fn();
    render(
      <StudioCommandHeader
        activeStage="process"
        artifactKind="lab"
        assistantOpen={false}
        canExport
        canRedo={false}
        canUndo
        hasUnsavedChanges={false}
        title="Teacher Draft Lab"
        onAssistantToggle={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
        onNewLab={vi.fn()}
        onNewTechnique={vi.fn()}
        onOpenAbout={vi.fn()}
        onRedo={vi.fn()}
        onSave={vi.fn()}
        onStageChange={onStageChange}
        onTitleCommit={vi.fn()}
        onUndo={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Process" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Setup" }));
    expect(onStageChange).toHaveBeenCalledWith("setup");
    fireEvent.click(screen.getByRole("button", { name: /more/i }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /new lab/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /export json/i })).toBeInTheDocument();
    expect(screen.queryByText(/start template/i)).not.toBeInTheDocument();
  });

  it("synchronizes outline selection and uses the searchable source template library", () => {
    const onSelect = vi.fn();
    const onAddTemplate = vi.fn();
    render(
      <ProcessOutline
        draft={demoLab}
        selectedNodeId={demoLab.process.startNodeId}
        onAddBranch={vi.fn()}
        onAddRetry={vi.fn()}
        onAddTemplate={onAddTemplate}
        onDelete={vi.fn()}
        onSelect={onSelect}
        onSetStart={vi.fn()}
      />,
    );

    const firstRow = screen.getByRole("button", { name: new RegExp(demoLab.process.nodes[0].title, "i") });
    expect(firstRow).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByRole("button", { name: /add step or workflow/i }));
    const library = screen.getByRole("dialog", { name: /step and workflow library/i });
    const stepGroup = within(library).getByRole("heading", { name: /step types/i }).closest("section") as HTMLElement;
    const workflowGroup = within(library).getByRole("heading", { name: /workflows/i }).closest("section") as HTMLElement;
    expect(within(stepGroup).getAllByRole("button")).toHaveLength(4);
    expect(within(workflowGroup).getAllByRole("button")).toHaveLength(2);
    fireEvent.click(within(library).getByRole("button", { name: /browse all steps and workflows/i }));
    expect(within(library).getByRole("heading", { name: /start from lab/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: /search steps and workflows/i }), { target: { value: "Observation" } });
    fireEvent.click(screen.getByRole("button", { name: /Observation/i }));
    expect(onAddTemplate).toHaveBeenCalled();
  });

  it("dismisses canvas-local panels with Escape or an outside pointer and restores focus", async () => {
    window.localStorage.clear();
    render(<TeacherStudio />);

    const addButton = screen.getByRole("button", { name: /add step or workflow/i });
    fireEvent.click(addButton);
    expect(screen.getByRole("dialog", { name: /step and workflow library/i })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: /step and workflow library/i })).not.toBeInTheDocument();
    await waitFor(() => expect(addButton).toHaveFocus());

    const connectionsButton = screen.getByRole("button", { name: "Connections" });
    fireEvent.click(connectionsButton);
    expect(connectionsButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(connectionsButton).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(connectionsButton).toHaveFocus());
  });
});
