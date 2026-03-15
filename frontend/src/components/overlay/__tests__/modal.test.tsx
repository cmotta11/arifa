import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../modal";

describe("Modal", () => {
  it("renders children when open", () => {
    render(
      <Modal isOpen onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("does not render children when closed", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.queryByText("Modal content")).not.toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Confirm Action">
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
  });

  it("does not render close button when title is absent", () => {
    render(
      <Modal isOpen onClose={vi.fn()}>
        <p>No title</p>
      </Modal>,
    );
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("close button has aria-label", () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>,
    );
    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveAttribute("aria-label", "Close");
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} title="Test">
        <p>Content</p>
      </Modal>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders children content within dialog", () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Edit">
        <input placeholder="Type here" />
      </Modal>,
    );
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
