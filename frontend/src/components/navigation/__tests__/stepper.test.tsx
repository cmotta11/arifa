import { render, screen } from "@testing-library/react";
import { Stepper } from "../stepper";

const steps = [
  { label: "Personal Info" },
  { label: "Documents" },
  { label: "Review" },
];

describe("Stepper", () => {
  it("renders all step labels", () => {
    render(<Stepper steps={steps} currentStep={1} />);
    expect(screen.getByText("Personal Info")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("renders step numbers for incomplete, non-current steps", () => {
    render(<Stepper steps={steps} currentStep={1} />);
    // Step 2 and 3 are not current and not completed, so they show numbers
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows step number for the current step", () => {
    render(<Stepper steps={steps} currentStep={2} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("highlights the current step with primary border", () => {
    const { container } = render(<Stepper steps={steps} currentStep={2} />);
    // The current step circle should have border-primary
    const circles = container.querySelectorAll(".rounded-full");
    // Step 2 is index 1
    expect(circles[1]).toHaveClass("border-primary");
    expect(circles[1]).toHaveClass("text-primary");
  });

  it("shows completed steps with primary background (filled)", () => {
    const { container } = render(
      <Stepper steps={steps} currentStep={3} completedSteps={[1, 2]} />,
    );
    const circles = container.querySelectorAll(".rounded-full");
    // Steps 1 and 2 are completed
    expect(circles[0]).toHaveClass("bg-primary");
    expect(circles[0]).toHaveClass("text-white");
    expect(circles[1]).toHaveClass("bg-primary");
    expect(circles[1]).toHaveClass("text-white");
  });

  it("completed steps show CheckIcon instead of number", () => {
    const { container } = render(
      <Stepper steps={steps} currentStep={3} completedSteps={[1, 2]} />,
    );
    const circles = container.querySelectorAll(".rounded-full");
    // Completed circles should contain SVG (CheckIcon), not number text
    expect(circles[0].querySelector("svg")).toBeInTheDocument();
    expect(circles[1].querySelector("svg")).toBeInTheDocument();
    // Current step (3) should show number, not icon
    expect(circles[2].querySelector("svg")).not.toBeInTheDocument();
    expect(circles[2]).toHaveTextContent("3");
  });

  it("non-current non-completed steps have gray styling", () => {
    const { container } = render(<Stepper steps={steps} currentStep={1} />);
    const circles = container.querySelectorAll(".rounded-full");
    // Steps 2 and 3 are gray
    expect(circles[1]).toHaveClass("border-gray-300");
    expect(circles[1]).toHaveClass("text-gray-400");
    expect(circles[2]).toHaveClass("border-gray-300");
  });

  it("renders step descriptions when provided", () => {
    const stepsWithDesc = [
      { label: "Info", description: "Basic details" },
      { label: "Docs", description: "Upload files" },
      { label: "Done" },
    ];
    render(<Stepper steps={stepsWithDesc} currentStep={1} />);
    expect(screen.getByText("Basic details")).toBeInTheDocument();
    expect(screen.getByText("Upload files")).toBeInTheDocument();
  });

  it("renders connector lines between steps", () => {
    const { container } = render(<Stepper steps={steps} currentStep={1} />);
    // There should be steps.length - 1 connector lines
    const connectors = container.querySelectorAll(".h-0\\.5.flex-1");
    expect(connectors).toHaveLength(steps.length - 1);
  });

  it("completed step connector has primary color", () => {
    const { container } = render(
      <Stepper steps={steps} currentStep={3} completedSteps={[1, 2]} />,
    );
    const connectors = container.querySelectorAll(".h-0\\.5.flex-1");
    expect(connectors[0]).toHaveClass("bg-primary");
    expect(connectors[1]).toHaveClass("bg-primary");
  });

  it("non-completed step connector has gray color", () => {
    const { container } = render(<Stepper steps={steps} currentStep={1} />);
    const connectors = container.querySelectorAll(".h-0\\.5.flex-1");
    connectors.forEach((c) => {
      expect(c).toHaveClass("bg-gray-300");
    });
  });

  it("has navigation landmark with aria-label Progress", () => {
    render(<Stepper steps={steps} currentStep={1} />);
    expect(screen.getByRole("navigation", { name: "Progress" })).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Stepper steps={steps} currentStep={1} className="my-stepper" />);
    expect(screen.getByRole("navigation")).toHaveClass("my-stepper");
  });
});
