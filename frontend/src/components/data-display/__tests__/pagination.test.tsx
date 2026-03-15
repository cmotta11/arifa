import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "../pagination";

describe("Pagination", () => {
  it("returns null when totalPages is 1", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when totalPages is 0", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders page buttons for small page counts", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
    );
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole("button", { name: String(i) })).toBeInTheDocument();
    }
  });

  it("renders previous and next buttons", () => {
    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeInTheDocument();
  });

  it("disables previous button on page 1", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
  });

  it("disables next button on the last page", () => {
    render(
      <Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
  });

  it("enables both prev and next on middle pages", () => {
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeEnabled();
  });

  it("calls onPageChange with previous page when prev is clicked", async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={handlePageChange} />,
    );

    await user.click(screen.getByRole("button", { name: "pagination.previous" }));
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with next page when next is clicked", async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={handlePageChange} />,
    );

    await user.click(screen.getByRole("button", { name: "pagination.next" }));
    expect(handlePageChange).toHaveBeenCalledWith(4);
  });

  it("calls onPageChange with page number when a page button is clicked", async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={handlePageChange} />,
    );

    await user.click(screen.getByRole("button", { name: "4" }));
    expect(handlePageChange).toHaveBeenCalledWith(4);
  });

  it("highlights current page with aria-current", () => {
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "3" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "2" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows ellipsis for many pages", () => {
    render(
      <Pagination currentPage={5} totalPages={10} onPageChange={vi.fn()} />,
    );
    const ellipses = screen.getAllByText("...");
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });

  it("has navigation landmark with aria-label", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByRole("navigation", { name: "pagination.label" })).toBeInTheDocument();
  });
});
