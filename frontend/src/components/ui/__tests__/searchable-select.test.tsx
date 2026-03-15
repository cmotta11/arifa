import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchableSelect } from "../searchable-select";

const options = [
  { value: "us", label: "United States" },
  { value: "pa", label: "Panama" },
  { value: "mx", label: "Mexico" },
];

describe("SearchableSelect", () => {
  it("renders with a label", () => {
    render(
      <SearchableSelect
        label="Country"
        options={options}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Country")).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
  });

  it("uses id prop when provided", () => {
    render(
      <SearchableSelect
        id="custom-id"
        label="Country"
        options={options}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Country")).toHaveAttribute("id", "custom-id");
  });

  it("derives id from label when id is not provided", () => {
    render(
      <SearchableSelect
        label="My Country"
        options={options}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("My Country")).toHaveAttribute("id", "my-country");
  });

  it("shows error message", () => {
    render(
      <SearchableSelect
        label="Country"
        options={options}
        value=""
        onChange={vi.fn()}
        error="Selection required"
      />,
    );
    expect(screen.getByText("Selection required")).toBeInTheDocument();
    const input = screen.getByLabelText("Country");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "country-error");
  });

  it("does not show error when none provided", () => {
    render(
      <SearchableSelect
        label="Country"
        options={options}
        value=""
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Country");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText("Selection required")).not.toBeInTheDocument();
  });

  it("filters options when user types a query", async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelect
        label="Country"
        options={options}
        value=""
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Country");
    await user.click(input);
    await user.type(input, "pan");

    // "Panama" should be visible, "United States" and "Mexico" should not
    expect(screen.getByText("Panama")).toBeInTheDocument();
    expect(screen.queryByText("United States")).not.toBeInTheDocument();
    expect(screen.queryByText("Mexico")).not.toBeInTheDocument();
  });

  it("shows no results message when query matches nothing", async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelect
        label="Country"
        options={options}
        value=""
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Country");
    await user.click(input);
    await user.type(input, "zzz");

    expect(screen.getByText("common.noResults")).toBeInTheDocument();
  });

  it("displays selected value label", () => {
    render(
      <SearchableSelect
        label="Country"
        options={options}
        value="pa"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Country")).toHaveValue("Panama");
  });

  it("shows placeholder when no value selected", () => {
    render(
      <SearchableSelect
        label="Country"
        options={options}
        value=""
        onChange={vi.fn()}
        placeholder="Choose a country"
      />,
    );
    expect(screen.getByPlaceholderText("Choose a country")).toBeInTheDocument();
  });
});
