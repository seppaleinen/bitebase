import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Progress } from "../src/web/progress";

describe("Progress", () => {
  it("renders progress bar with aria attributes", () => {
    render(<Progress value={50} max={100} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
  });

  it("renders with default values when no props given", () => {
    render(<Progress />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("calculates percentage correctly", () => {
    render(<Progress value={25} max={100} />);
    const fill = screen.getByRole("progressbar").firstChild as HTMLElement;
    expect(fill.style.width).toBe("25%");
  });

  it("clamps value to 0-100 range", () => {
    const { rerender } = render(<Progress value={-10} max={100} />);
    let fill = screen.getByRole("progressbar").firstChild as HTMLElement;
    expect(fill.style.width).toBe("0%");

    rerender(<Progress value={150} max={100} />);
    fill = screen.getByRole("progressbar").firstChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("uses accent color for fill", () => {
    render(<Progress value={50} />);
    const fill = screen.getByRole("progressbar").firstChild as HTMLElement;
    expect(fill.className).toContain("bg-accent");
  });

  it("forwards className to container", () => {
    render(<Progress className="custom-progress" value={50} />);
    expect(screen.getByRole("progressbar").className).toContain("custom-progress");
  });
});
