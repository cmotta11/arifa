import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "../data-table";

type Row = { id: string; name: string; email: string };

const columns = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
];

const data: Row[] = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

describe("DataTable", () => {
  it("renders column headers", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders row data", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("renders empty state when data is empty", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders custom empty message", () => {
    render(
      <DataTable columns={columns} data={[]} emptyMessage="Nothing found" />,
    );
    expect(screen.getByText("Nothing found")).toBeInTheDocument();
  });

  it("shows loading spinner when loading", () => {
    render(<DataTable columns={columns} data={[]} loading />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("No data available")).not.toBeInTheDocument();
  });

  it("calls onRowClick when a row is clicked", async () => {
    const user = userEvent.setup();
    const handleRowClick = vi.fn();
    render(
      <DataTable columns={columns} data={data} onRowClick={handleRowClick} />,
    );

    await user.click(screen.getByText("Alice"));
    expect(handleRowClick).toHaveBeenCalledWith(data[0]);
  });

  it("calls onRowClick when Enter is pressed on a row", async () => {
    const user = userEvent.setup();
    const handleRowClick = vi.fn();
    render(
      <DataTable columns={columns} data={data} onRowClick={handleRowClick} />,
    );

    const row = screen.getByText("Alice").closest("tr")!;
    row.focus();
    await user.keyboard("{Enter}");
    expect(handleRowClick).toHaveBeenCalledWith(data[0]);
  });

  it("renders custom cell via column render function", () => {
    const customColumns = [
      {
        key: "name",
        header: "Name",
        render: (row: Row) => <strong data-testid="bold-name">{row.name}</strong>,
      },
      { key: "email", header: "Email" },
    ];

    render(<DataTable columns={customColumns} data={data} />);
    const boldNames = screen.getAllByTestId("bold-name");
    expect(boldNames).toHaveLength(2);
    expect(boldNames[0]).toHaveTextContent("Alice");
    expect(boldNames[1]).toHaveTextContent("Bob");
  });

  it("uses keyExtractor when provided", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(row) => row.email}
      />,
    );
    // Ensure table renders without error (key extraction is internal)
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
  });

  it("rows have tabIndex when onRowClick is provided", () => {
    const { container } = render(
      <DataTable columns={columns} data={data} onRowClick={vi.fn()} />,
    );
    const rows = container.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      expect(row).toHaveAttribute("tabindex", "0");
    });
  });

  it("rows do not have tabIndex when onRowClick is not provided", () => {
    const { container } = render(
      <DataTable columns={columns} data={data} />,
    );
    const rows = container.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      expect(row).not.toHaveAttribute("tabindex");
    });
  });
});
