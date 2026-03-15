import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "../tabs";

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "details", label: "Details" },
  { key: "history", label: "History" },
];

describe("Tabs", () => {
  it("renders all tab labels", () => {
    render(<Tabs tabs={tabs} activeTab="overview" onChange={vi.fn()} />);
    tabs.forEach((tab) => {
      expect(screen.getByRole("button", { name: tab.label })).toBeInTheDocument();
    });
  });

  it("highlights the active tab with aria-current", () => {
    render(<Tabs tabs={tabs} activeTab="details" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("button", { name: "History" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("calls onChange with tab key when clicked", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="overview" onChange={handleChange} />);

    await user.click(screen.getByRole("button", { name: "History" }));
    expect(handleChange).toHaveBeenCalledWith("history");
  });

  it("applies active styles to the active tab", () => {
    render(<Tabs tabs={tabs} activeTab="overview" onChange={vi.fn()} />);
    const activeButton = screen.getByRole("button", { name: "Overview" });
    expect(activeButton).toHaveClass("border-primary");
    expect(activeButton).toHaveClass("text-primary");
  });

  it("applies inactive styles to non-active tabs", () => {
    render(<Tabs tabs={tabs} activeTab="overview" onChange={vi.fn()} />);
    const inactiveButton = screen.getByRole("button", { name: "Details" });
    expect(inactiveButton).toHaveClass("border-transparent");
    expect(inactiveButton).toHaveClass("text-gray-500");
  });

  it("has a navigation landmark with aria-label", () => {
    render(<Tabs tabs={tabs} activeTab="overview" onChange={vi.fn()} />);
    expect(screen.getByRole("navigation", { name: "Tabs" })).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <Tabs tabs={tabs} activeTab="overview" onChange={vi.fn()} className="extra" />,
    );
    expect(container.firstChild).toHaveClass("extra");
  });
});
