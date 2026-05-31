import { useEffect } from "react";
import { router } from "expo-router";

export default function Index() {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (router as any).replace("/(app)/explore");
  }, []);
  return null;
}
