import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar, AvatarImage, AvatarFallback } from "../src/web/avatar";

describe("Avatar", () => {
  it("renders container with rounded-full", () => {
    render(<Avatar data-testid="avatar" />);
    const el = screen.getByTestId("avatar");
    expect(el.className).toContain("rounded-full");
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("w-10");
  });
});

describe("AvatarImage", () => {
  it("renders img with correct src and alt", () => {
    render(<AvatarImage src="/photo.jpg" alt="User photo" data-testid="img" />);
    const img = screen.getByTestId("img") as HTMLImageElement;
    expect(img.src).toContain("/photo.jpg");
    expect(img.alt).toBe("User photo");
  });

  it("defaults alt to empty string", () => {
    render(<AvatarImage src="/photo.jpg" data-testid="img" />);
    const img = screen.getByTestId("img") as HTMLImageElement;
    expect(img.alt).toBe("");
  });
});

describe("AvatarFallback", () => {
  it("renders fallback content", () => {
    render(<AvatarFallback>JD</AvatarFallback>);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("applies fallback background and text classes", () => {
    render(<AvatarFallback>AB</AvatarFallback>);
    const el = screen.getByText("AB");
    expect(el.className).toContain("bg-accent-subtle");
    expect(el.className).toContain("text-accent-dark");
  });
});
