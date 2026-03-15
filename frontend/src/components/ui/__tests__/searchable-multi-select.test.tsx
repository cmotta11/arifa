import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchableMultiSelect } from "../searchable-multi-select";

const options = [
  { value: "us", label: "United States" },
  { value: "pa", label: "Panama" },
  { value: "mx", label: "Mexico" },
];

describe("SearchableMultiSelect", () => {
  it("renders with a label", () => {
    render(
      <SearchableMultiSelect
        label="Countries"
        options={options}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Countries")).toBeInTheDocument();
  });

  it("renders selected tags", () => {
    render(
      <SearchableMultiSelect
        label="Countries"
        options={options}
        value={["us", "pa"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("United States")).toBeInTheDocument();
    expect(screen.getByText("Panama")).toBeInTheDocument();
    expect(screen.queryByText("Mexico")).not.toBeInTheDocument();
  });

  it("remove button has aria-label for each selected tag", () => {
    render(
      <SearchableMultiSelect
        label="Countries"
        options={options}
        value={["us", "pa"]}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "common.remove United States" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "common.remove Panama" }),
    ).toBeInTheDocument();
  });

  it("calls onChange without removed value when remove button is clicked", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SearchableMultiSelect
        label="Countries"
        options={options}
        value={["us", "pa"]}
        onChange={handleChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "common.remove United States" }),
    );
    expect(handleChange).toHaveBeenCalledWith(["pa"]);
  });

  it("shows error message", () => {
    render(
      <SearchableMultiSelect
        label="Countries"
        options={options}
        value={[]}
        onChange={vi.fn()}
        error="At least one required"
      />,
    );
    expect(screen.getByText("At least one required")).toBeInTheDocument();
  });

  it("error element has correct id for aria-describedby", () => {
    render(
      <SearchableMultiSelect
        label="Countries"
        options={options}
        value={[]}
        onChange={vi.fn()}
        error="At least one required"
      />,
    );
    const errorEl = screen.getByText("At least one required");
    expect(errorEl).toHaveAttribute("id", "countries-error");

    const input = screen.getByLabelText("Countries");
    expect(input).toHaveAttribute("aria-describedby", "countries-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("uses id prop when provided", () => {
    render(
      <SearchableMultiSelect
        id="my-multi"
        label="Countries"
        options={options}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Countries")).toHaveAttribute("id", "my-multi");
  });

  it("shows placeholder when no values selected", () => {
    render(
      <SearchableMultiSelect
        label="Countries"
        options={options}
        value={[]}
        onChange={vi.fn()}
        placeholder="Select countries"
      />,
    );
    expect(screen.getByPlaceholderText("Select countries")).toBeInTheDocument();
  });

  it("hides placeholder when values are selected", () => {
    render(
      <SearchableMultiSelect
        label="Countries"
        options={options}
        value={["us"]}
        onChange={vi.fn()}
        placeholder="Select countries"
      />,
    );
    expect(screen.queryByPlaceholderText("Select countries")).not.toBeInTheDocument();
  });

  it("filters options when user types", async () => {
    const user = userEvent.setup();
    render(
      <SearchableMultiSelect
        label="Countries"
        options={options}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Countries");
    await user.click(input);
    await user.type(input, "mex");

    expect(screen.getByText("Mexico")).toBeInTheDocument();
    expect(screen.queryByText("Panama")).not.toBeInTheDocument();
    expect(screen.queryByText("United States")).not.toBeInTheDocument();
  });
});
