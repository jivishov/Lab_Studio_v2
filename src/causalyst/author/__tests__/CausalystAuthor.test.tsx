import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CausalystAuthor } from "../CausalystAuthor";

describe("Causalyst authoring and preview", () => {
  it("supports keyboard-native domain selection and exposes the teacher-review boundary", () => {
    render(<CausalystAuthor />);
    fireEvent.change(screen.getByLabelText("Domain and artifact"), { target: { value: "assay" } });
    expect(screen.getByText(/assay@1\.0\.0/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /rubric/i }));
    expect(screen.getByText(/Final decision:/i)).toHaveTextContent(/teacher required/i);
    fireEvent.click(screen.getByRole("tab", { name: /preview/i }));
    fireEvent.click(screen.getByRole("button", { name: "Show learner preview" }));
    expect(screen.getByRole("heading", { name: /Assay evidence review/i })).toBeInTheDocument();
    expect(screen.getByText(/does not generate prompts/i)).toBeInTheDocument();
  });
});
