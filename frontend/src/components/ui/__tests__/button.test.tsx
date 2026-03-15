import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../button";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("is disabled when loading is true", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows Spinner when loading", () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.getByText("Saving")).toBeInTheDocument();
  });

  it("does not show Spinner when not loading", () => {
    render(<Button>Save</Button>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  describe("variants", () => {
    it.each<{ variant: "primary" | "secondary" | "danger" | "ghost"; cls: string }>([
      { variant: "primary", cls: "bg-primary" },
      { variant: "secondary", cls: "bg-white" },
      { variant: "danger", cls: "bg-error" },
      { variant: "ghost", cls: "bg-transparent" },
    ])("renders $variant variant with correct classes", ({ variant, cls }) => {
      render(<Button variant={variant}>Btn</Button>);
      expect(screen.getByRole("button")).toHaveClass(cls);
    });
  });

  describe("sizes", () => {
    it.each<{ size: "sm" | "md" | "lg"; cls: string }>([
      { size: "sm", cls: "px-3" },
      { size: "md", cls: "px-4" },
      { size: "lg", cls: "px-6" },
    ])("renders $size size with correct classes", ({ size, cls }) => {
      render(<Button size={size}>Btn</Button>);
      expect(screen.getByRole("button")).toHaveClass(cls);
    });
  });

  it("applies custom className", () => {
    render(<Button className="extra-class">Styled</Button>);
    expect(screen.getByRole("button")).toHaveClass("extra-class");
  });

  it("forwards additional HTML attributes", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
