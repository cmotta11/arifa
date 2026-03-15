import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../select";

const options = [
  { value: "us", label: "United States" },
  { value: "pa", label: "Panama" },
  { value: "mx", label: "Mexico" },
];

describe("Select", () => {
  it("renders all options", () => {
    render(<Select options={options} />);
    const selectEl = screen.getByRole("combobox");
    expect(selectEl).toBeInTheDocument();

    options.forEach((opt) => {
      expect(screen.getByRole("option", { name: opt.label })).toBeInTheDocument();
    });
  });

  it("renders with a label", () => {
    render(<Select label="Country" options={options} />);
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
  });

  it("associates label with select via derived id", () => {
    render(<Select label="Country" options={options} />);
    const selectEl = screen.getByLabelText("Country");
    expect(selectEl).toHaveAttribute("id", "country");
  });

  it("uses custom id when provided", () => {
    render(<Select label="Country" id="my-select" options={options} />);
    const selectEl = screen.getByLabelText("Country");
    expect(selectEl).toHaveAttribute("id", "my-select");
  });

  it("renders placeholder as a disabled option", () => {
    render(<Select options={options} placeholder="Select a country" />);
    const placeholder = screen.getByRole("option", { name: "Select a country" });
    expect(placeholder).toBeDisabled();
    expect(placeholder).toHaveValue("");
  });

  it("calls onChange when a value is selected", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Select options={options} onChange={handleChange} />);

    await user.selectOptions(screen.getByRole("combobox"), "pa");
    expect(handleChange).toHaveBeenCalled();
  });

  it("shows error message", () => {
    render(<Select label="Country" options={options} error="Required field" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
    const selectEl = screen.getByLabelText("Country");
    expect(selectEl).toHaveAttribute("aria-invalid", "true");
    expect(selectEl).toHaveAttribute("aria-describedby", "country-error");
  });

  it("does not show error when none provided", () => {
    render(<Select label="Country" options={options} />);
    const selectEl = screen.getByLabelText("Country");
    expect(selectEl).toHaveAttribute("aria-invalid", "false");
  });

  it("renders in disabled state", () => {
    render(<Select label="Country" options={options} disabled />);
    expect(screen.getByLabelText("Country")).toBeDisabled();
  });

  it("has error border class when error is present", () => {
    render(<Select label="Country" options={options} error="Oops" />);
    expect(screen.getByLabelText("Country")).toHaveClass("border-error");
  });

  it("has normal border when no error", () => {
    render(<Select label="Country" options={options} />);
    expect(screen.getByLabelText("Country")).toHaveClass("border-gray-300");
  });
});
