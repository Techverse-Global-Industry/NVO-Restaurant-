import { parentPort } from "node:worker_threads";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import * as ort from "onnxruntime-web";
// Portable CPU inference in WebAssembly avoids native DLL dependencies on Windows.
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = pathToFileURL(
  path.resolve("node_modules/onnxruntime-web/dist") + path.sep,
).href;
globalThis[Symbol.for("onnxruntime")] = {
  ...ort,
  InferenceSession: {
    create: async (file, options) =>
      ort.InferenceSession.create(
        typeof file === "string" ? await readFile(file) : file,
        {
          ...options,
          executionProviders: ["wasm"],
          graphOptimizationLevel: "disabled",
        },
      ),
  },
};
const { pipeline, env } = await import("@huggingface/transformers");
env.cacheDir = path.resolve("data/models");
env.allowRemoteModels = process.argv.includes("--setup");
env.backends.onnx.logLevel = "error";
const pipelines = new Map();
async function translate(text, from) {
  if (from === "fr")
    text = text.replace(/\b(notre|votre) carte\b/gi, "$1 menu");
  const pair = from === "en" ? "en-fr" : "fr-en";
  if (!pipelines.has(pair))
    pipelines.set(
      pair,
      await pipeline("translation", `Xenova/opus-mt-${pair}`, {
        dtype: "q8",
        device: "auto",
        session_options: { executionProviders: ["wasm"] },
      }),
    );
  const translator = pipelines.get(pair);
  const paragraphs = text.split(/\n/);
  const output = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      output.push("");
      continue;
    }
    // Keep each inference within the model's context, splitting at word boundaries.
    const chunks = paragraph.match(/.{1,450}(?:\s|$)|\S{1,450}/gu) || [
      paragraph,
    ];
    const parts = [];
    for (const chunk of chunks) {
      const translated = await translator(chunk.trim(), {
        max_new_tokens: 256,
        num_beams: 3,
      });
      parts.push(translated[0].translation_text);
    }
    output.push(parts.join(" "));
  }
  return output.join("\n");
}
if (process.argv.includes("--setup")) {
  console.log("Downloading and checking the two local translation models…");
  console.log(
    "EN → FR:",
    await translate(
      "Welcome to NVO Restaurant. Discover our menu and reserve your table.",
      "en",
    ),
  );
  console.log(
    "FR → EN:",
    await translate(
      "Bienvenue chez NVO Restaurant. Découvrez notre carte et réservez votre table.",
      "fr",
    ),
  );
  console.log(
    "Local translation is ready. Model files are stored in data/models.",
  );
} else {
  let queue = Promise.resolve();
  parentPort.on("message", ({ id, text, from }) => {
    queue = queue.then(async () => {
      try {
        parentPort.postMessage({ id, text: await translate(text, from) });
      } catch {
        parentPort.postMessage({
          id,
          error:
            "Local translation is unavailable. Run npm run setup:translation on the server, then try again.",
        });
      }
    });
  });
}
