import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("renders with a label", () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  });

  it("derives id from label", () => {
    render(<Textarea label="Additional Notes" />);
    const textarea = screen.getByLabelText("Additional Notes");
    expect(textarea).toHaveAttribute("id", "additional-notes");
  });

  it("uses custom id when provided", () => {
    render(<Textarea label="Notes" id="custom-ta" />);
    expect(screen.getByLabelText("Notes")).toHaveAttribute("id", "custom-ta");
  });

  it("shows error message", () => {
    render(<Textarea label="Notes" error="Too short" />);
    expect(screen.getByText("Too short")).toBeInTheDocument();
    const textarea = screen.getByLabelText("Notes");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAttribute("aria-describedby", "notes-error");
  });

  it("shows helper text when no error", () => {
    render(<Textarea label="Notes" helperText="Max 500 chars" />);
    expect(screen.getByText("Max 500 chars")).toBeInTheDocument();
    const textarea = screen.getByLabelText("Notes");
    expect(textarea).toHaveAttribute("aria-describedby", "notes-helper");
  });

  it("does not show helper text when error is present", () => {
    render(<Textarea label="Notes" error="Required" helperText="Max 500 chars" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("Max 500 chars")).not.toBeInTheDocument();
  });

  it("renders in disabled state", () => {
    render(<Textarea label="Notes" disabled />);
    expect(screen.getByLabelText("Notes")).toBeDisabled();
  });

  it("forwards placeholder prop", () => {
    render(<Textarea placeholder="Enter notes..." />);
    expect(screen.getByPlaceholderText("Enter notes...")).toBeInTheDocument();
  });

  it("defaults to 3 rows", () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText("Notes")).toHaveAttribute("rows", "3");
  });

  it("accepts custom rows prop", () => {
    render(<Textarea label="Notes" rows={6} />);
    expect(screen.getByLabelText("Notes")).toHaveAttribute("rows", "6");
  });

  it("allows user input", async () => {
    const user = userEvent.setup();
    render(<Textarea label="Notes" />);
    const textarea = screen.getByLabelText("Notes");

    await user.type(textarea, "Hello world");
    expect(textarea).toHaveValue("Hello world");
  });

  it("has error border class when error is present", () => {
    render(<Textarea label="Notes" error="Bad" />);
    expect(screen.getByLabelText("Notes")).toHaveClass("border-error");
  });

  it("has normal border class when no error", () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText("Notes")).toHaveClass("border-gray-300");
  });

  it("renders without label", () => {
    render(<Textarea placeholder="No label" />);
    expect(screen.getByPlaceholderText("No label")).toBeInTheDocument();
  });
});
