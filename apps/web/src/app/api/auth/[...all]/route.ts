export const dynamic = "force-dynamic";

import { auth } from "@bitebase/api";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
