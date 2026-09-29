import { Worker } from "node:worker_threads";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { db } from "./db";
type Job = {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
const globalWorker = globalThis as unknown as {
  nvoTranslator?: Worker;
  nvoTranslations?: Map<string, Job>;
};
function worker() {
  if (globalWorker.nvoTranslator) return globalWorker.nvoTranslator;
  const w = new Worker(
    path.resolve(/* turbopackIgnore: true */ "scripts/translation-worker.mjs"),
  );
  globalWorker.nvoTranslations = new Map();
  globalWorker.nvoTranslator = w;
  w.unref();
  w.on("message", ({ id, text, error }) => {
    const job = globalWorker.nvoTranslations?.get(id);
    if (!job) return;
    clearTimeout(job.timer);
    globalWorker.nvoTranslations?.delete(id);
    if (error) job.reject(new Error(error));
    else job.resolve(text);
  });
  const fail = () => {
    for (const job of globalWorker.nvoTranslations?.values() || []) {
      clearTimeout(job.timer);
      job.reject(new Error("Local translation stopped. Please retry."));
    }
    globalWorker.nvoTranslations?.clear();
    globalWorker.nvoTranslator = undefined;
  };
  w.on("error", fail);
  w.on("exit", fail);
  return w;
}
export async function translate(text: string, from: "en" | "fr") {
  if (!text.trim()) return "";
  const key = createHash("sha256")
    .update("opus-v2:" + from + ":" + text)
    .digest("hex");
  const cached = db()
    .prepare("SELECT text FROM translation_cache WHERE id=?")
    .get(key) as { text: string } | undefined;
  if (cached) return cached.text;
  const w = worker();
  if ((globalWorker.nvoTranslations?.size || 0) >= 12)
    throw new Error("Translation is busy. Please retry in a moment.");
  const translated = await new Promise<string>((resolve, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      globalWorker.nvoTranslations?.delete(id);
      reject(
        new Error("Translation is taking longer than expected. Please retry."),
      );
    }, 120000);
    globalWorker.nvoTranslations!.set(id, { resolve, reject, timer });
    w.postMessage({ id, text, from });
  });
  db()
    .prepare("INSERT OR REPLACE INTO translation_cache VALUES(?,?,?)")
    .run(key, translated, new Date().toISOString());
  return translated;
}
