import { describe, it, expect, vi } from "vitest";
import { keyboardHandler } from "../src/lib/keyboard-handler";

describe("keyboardHandler", () => {
  it("calls onActivate on Enter key", () => {
    const fn = vi.fn();
    const handler = keyboardHandler(fn);

    handler.onKeyDown({ key: "Enter", preventDefault: vi.fn() });

    expect(fn).toHaveBeenCalledOnce();
  });

  it("calls onActivate on Space key", () => {
    const fn = vi.fn();
    const handler = keyboardHandler(fn);

    handler.onKeyDown({ key: " ", preventDefault: vi.fn() });

    expect(fn).toHaveBeenCalledOnce();
  });

  it("calls onActivate on Spacebar (legacy) key", () => {
    const fn = vi.fn();
    const handler = keyboardHandler(fn);

    handler.onKeyDown({ key: "Spacebar", preventDefault: vi.fn() });

    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not call onActivate on other keys", () => {
    const fn = vi.fn();
    const handler = keyboardHandler(fn);

    handler.onKeyDown({ key: "Escape", preventDefault: vi.fn() });

    expect(fn).not.toHaveBeenCalled();
  });

  it("calls preventDefault on matching keys", () => {
    const preventDefault = vi.fn();
    const handler = keyboardHandler(vi.fn());

    handler.onKeyDown({ key: "Enter", preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("sets accessible and role properties", () => {
    const handler = keyboardHandler(vi.fn());
    expect(handler.accessible).toBe(true);
    expect(handler.role).toBe("button");
  });
});
