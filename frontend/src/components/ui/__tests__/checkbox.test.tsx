import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "../checkbox";

describe("Checkbox", () => {
  it("renders with a label", () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.getByLabelText("Accept terms")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("derives id from label", () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("id", "accept-terms");
  });

  it("uses custom id when provided", () => {
    render(<Checkbox label="Accept terms" id="custom-cb" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("id", "custom-cb");
  });

  it("renders description text", () => {
    render(
      <Checkbox label="Newsletter" description="Receive weekly updates" />,
    );
    expect(screen.getByText("Receive weekly updates")).toBeInTheDocument();
  });

  it("links description via aria-describedby", () => {
    render(
      <Checkbox label="Newsletter" description="Receive weekly updates" />,
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-describedby", "newsletter-desc");
  });

  it("shows error message", () => {
    render(<Checkbox label="Accept" error="You must accept" />);
    expect(screen.getByText("You must accept")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAttribute("aria-describedby", "accept-error");
  });

  it("sets aria-invalid to false when no error", () => {
    render(<Checkbox label="Accept" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "false");
  });

  it("toggles checked state on click", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Checkbox label="Agree" onChange={handleChange} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(checkbox).toBeChecked();
  });

  it("can be disabled", () => {
    render(<Checkbox label="Agree" disabled />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("can be pre-checked via defaultChecked", () => {
    render(<Checkbox label="Remember me" defaultChecked />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("type attribute is checkbox", () => {
    render(<Checkbox label="Test" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("type", "checkbox");
  });
});
