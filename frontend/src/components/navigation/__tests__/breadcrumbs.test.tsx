import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumbs } from "../breadcrumbs";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("Breadcrumbs", () => {
  it("returns null when items is empty", () => {
    const { container } = renderWithRouter(<Breadcrumbs items={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all breadcrumb labels", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Clients", href: "/clients" },
      { label: "Detail" },
    ];
    renderWithRouter(<Breadcrumbs items={items} />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Clients")).toBeInTheDocument();
    expect(screen.getByText("Detail")).toBeInTheDocument();
  });

  it("renders links for non-last items with href", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Clients", href: "/clients" },
      { label: "Detail" },
    ];
    renderWithRouter(<Breadcrumbs items={items} />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute("href", "/clients");
  });

  it("renders the last item as a span, not a link", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Detail" },
    ];
    renderWithRouter(<Breadcrumbs items={items} />);

    expect(screen.queryByRole("link", { name: "Detail" })).not.toBeInTheDocument();
    const lastItem = screen.getByText("Detail");
    expect(lastItem.tagName).toBe("SPAN");
    expect(lastItem).toHaveClass("font-medium");
  });

  it("renders items without href as spans (even if not last)", () => {
    const items = [
      { label: "Home" },
      { label: "Section" },
      { label: "Page" },
    ];
    renderWithRouter(<Breadcrumbs items={items} />);

    // All should be spans since none have href (last is always span)
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("has navigation landmark with aria-label Breadcrumb", () => {
    const items = [{ label: "Home", href: "/" }, { label: "Page" }];
    renderWithRouter(<Breadcrumbs items={items} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("renders separator chevrons between items", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Clients", href: "/clients" },
      { label: "Detail" },
    ];
    const { container } = renderWithRouter(<Breadcrumbs items={items} />);
    // Chevron SVGs appear between items (items.length - 1 separators)
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
  });

  it("renders a single item as a span with no separator", () => {
    const items = [{ label: "Dashboard" }];
    const { container } = renderWithRouter(<Breadcrumbs items={items} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("applies custom className", () => {
    const items = [{ label: "Home", href: "/" }];
    renderWithRouter(<Breadcrumbs items={items} className="my-class" />);
    expect(screen.getByRole("navigation")).toHaveClass("my-class");
  });
});
