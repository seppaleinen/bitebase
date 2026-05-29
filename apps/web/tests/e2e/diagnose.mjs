import { chromium } from "playwright-core";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];

page.on("pageerror", (err) => errors.push("PAGE_ERROR: " + err.message));
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning")
    errors.push("[console." + msg.type() + "] " + msg.text());
});

page.on("response", (resp) => {
  if (resp.status() >= 400)
    errors.push("[HTTP " + resp.status() + "] " + resp.url());
});

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

if (errors.length > 0) {
  console.log("=== ERRORS (" + errors.length + ") ===");
  errors.forEach((e) => console.log(e));
} else {
  console.log("No JS or HTTP errors");
}

const info = await page.evaluate(() => ({
  formExists: !!document.querySelector("form"),
  reactRoot: document.getElementById("__next") ? "root exists" : "missing",
  onsubmit: typeof document.querySelector("form")?.onsubmit,
  reactVersion: "__REACT_DEVTOOLS_GLOBAL_HOOK__" in window ? "present" : "absent",
}));
console.log("Page info:", JSON.stringify(info));

await browser.close();
