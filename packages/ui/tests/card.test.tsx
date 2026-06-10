import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../src/web/card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies default card classes", () => {
    render(<Card>Content</Card>);
    const card = screen.getByText("Content");
    expect(card.className).toContain("rounded-2xl");
    expect(card.className).toContain("border");
    expect(card.className).toContain("bg-white");
    expect(card.className).toContain("shadow-sm");
  });

  it("forwards className", () => {
    render(<Card className="custom-card">Custom</Card>);
    expect(screen.getByText("Custom").className).toContain("custom-card");
  });

  it("forwards ref", () => {
    const ref = { current: null };
    render(<Card ref={ref}>Ref</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("CardHeader", () => {
  it("renders children", () => {
    render(<CardHeader>Header Content</CardHeader>);
    expect(screen.getByText("Header Content")).toBeInTheDocument();
  });

  it("applies padding classes", () => {
    render(<CardHeader>Content</CardHeader>);
    expect(screen.getByText("Content").className).toContain("p-6");
  });
});

describe("CardTitle", () => {
  it("renders as h3", () => {
    render(<CardTitle>Title</CardTitle>);
    const el = screen.getByText("Title");
    expect(el.tagName).toBe("H3");
  });

  it("applies title classes", () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText("Title").className).toContain("text-lg");
    expect(screen.getByText("Title").className).toContain("font-semibold");
  });
});

describe("CardDescription", () => {
  it("renders description text", () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText("Description text")).toBeInTheDocument();
  });

  it("applies muted text classes", () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText("Desc").className).toContain("text-sm");
    expect(screen.getByText("Desc").className).toContain("text-gray-500");
  });
});

describe("CardContent", () => {
  it("renders children", () => {
    render(<CardContent>Content body</CardContent>);
    expect(screen.getByText("Content body")).toBeInTheDocument();
  });

  it("applies padding classes", () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText("Content").className).toContain("p-6");
    expect(screen.getByText("Content").className).toContain("pt-0");
  });
});
