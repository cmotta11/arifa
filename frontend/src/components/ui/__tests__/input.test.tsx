import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";

describe("Input", () => {
  it("renders with a label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("associates label with input via id", () => {
    render(<Input label="Full Name" />);
    const input = screen.getByLabelText("Full Name");
    expect(input).toHaveAttribute("id", "full-name");
  });

  it("uses custom id when provided", () => {
    render(<Input label="Email" id="custom-id" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "custom-id");
  });

  it("shows error message", () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-error");
  });

  it("shows helper text when no error", () => {
    render(<Input label="Email" helperText="Enter your email address" />);
    expect(screen.getByText("Enter your email address")).toBeInTheDocument();
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-describedby", "email-helper");
  });

  it("does not show helper text when error is present", () => {
    render(
      <Input label="Email" error="Required" helperText="Enter your email" />,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("Enter your email")).not.toBeInTheDocument();
  });

  it("renders in disabled state", () => {
    render(<Input label="Name" disabled />);
    expect(screen.getByLabelText("Name")).toBeDisabled();
  });

  it("forwards placeholder prop", () => {
    render(<Input placeholder="Type here..." />);
    expect(screen.getByPlaceholderText("Type here...")).toBeInTheDocument();
  });

  it("forwards type prop", () => {
    render(<Input label="Password" type="password" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("allows user input", async () => {
    const user = userEvent.setup();
    render(<Input label="Name" />);
    const input = screen.getByLabelText("Name");

    await user.type(input, "John Doe");
    expect(input).toHaveValue("John Doe");
  });

  it("renders without label", () => {
    render(<Input placeholder="No label" />);
    expect(screen.getByPlaceholderText("No label")).toBeInTheDocument();
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
  });

  it("has error border class when error is present", () => {
    render(<Input label="Field" error="Bad value" />);
    expect(screen.getByLabelText("Field")).toHaveClass("border-error");
  });

  it("has normal border class when no error", () => {
    render(<Input label="Field" />);
    expect(screen.getByLabelText("Field")).toHaveClass("border-gray-300");
  });
});
