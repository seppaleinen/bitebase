export function keyboardHandler(onActivate: () => void) {
  return {
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        onActivate();
      }
    },
    accessible: true,
    role: "button" as const,
  };
}
