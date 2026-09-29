import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
mkdirSync("artifacts/lighthouse-profile", { recursive: true });
const browser = await launch({
  userDataDir: path.resolve("artifacts/lighthouse-profile"),
  chromePath:
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  chromeFlags: ["--headless", "--disable-gpu", "--no-first-run"],
});
try {
  const result = await lighthouse(
    process.env.TEST_BASE_URL || "http://127.0.0.1:3001",
    {
      port: browser.port,
      output: ["json", "html"],
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    },
  );
  mkdirSync("artifacts", { recursive: true });
  const name = (process.env.AUDIT_NAME || "mobile").replace(
    /[^a-z0-9-]/gi,
    "-",
  );
  writeFileSync(`artifacts/lighthouse-${name}.json`, result.report[0]);
  writeFileSync(`artifacts/lighthouse-${name}.html`, result.report[1]);
  console.log(
    JSON.stringify(
      {
        scores: Object.fromEntries(
          Object.entries(result.lhr.categories).map(([k, v]) => [
            k,
            Math.round(v.score * 100),
          ]),
        ),
        findings: Object.entries(result.lhr.audits)
          .filter(([, v]) => v.score !== null && v.score < 1)
          .map(([id, v]) => ({
            id,
            title: v.title,
            score: v.score,
            display: v.displayValue,
          })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.kill();
}
