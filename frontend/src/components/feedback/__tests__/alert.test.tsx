import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alert } from "../alert";

describe("Alert", () => {
  it("renders children content", () => {
    render(<Alert>Something happened</Alert>);
    expect(screen.getByText("Something happened")).toBeInTheDocument();
  });

  it("has role=alert", () => {
    render(<Alert>Message</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(
      <Alert title="Warning">
        Please check your input
      </Alert>,
    );
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Please check your input")).toBeInTheDocument();
  });

  it("defaults to info variant", () => {
    const { container } = render(<Alert>Info message</Alert>);
    const alertEl = container.querySelector("[role=alert]")!;
    expect(alertEl.className).toContain("bg-blue-50");
  });

  it.each<{ variant: "info" | "success" | "warning" | "error"; bgClass: string }>([
    { variant: "info", bgClass: "bg-blue-50" },
    { variant: "success", bgClass: "bg-green-50" },
    { variant: "warning", bgClass: "bg-yellow-50" },
    { variant: "error", bgClass: "bg-red-50" },
  ])("renders $variant variant with $bgClass", ({ variant, bgClass }) => {
    const { container } = render(
      <Alert variant={variant}>Message</Alert>,
    );
    const alertEl = container.querySelector("[role=alert]")!;
    expect(alertEl.className).toContain(bgClass);
  });

  it("does not show dismiss button by default", () => {
    render(<Alert>No dismiss</Alert>);
    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });

  it("shows dismiss button when dismissible is true", () => {
    render(<Alert dismissible>Dismissible message</Alert>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("removes alert when dismiss button is clicked", async () => {
    const user = userEvent.setup();
    render(<Alert dismissible>Bye bye</Alert>);

    expect(screen.getByText("Bye bye")).toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("Bye bye")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <Alert className="my-custom-class">Styled</Alert>,
    );
    const alertEl = container.querySelector("[role=alert]")!;
    expect(alertEl.className).toContain("my-custom-class");
  });
});
