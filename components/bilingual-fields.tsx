"use client";
import { useEffect, useRef, useState } from "react";
import { Languages, Check, LoaderCircle } from "lucide-react";
import type { Entry } from "@/lib/types";
import { api } from "./provider";
type Field = "title" | "titleFr" | "description" | "descriptionFr";
export function BilingualFields({
  value,
  change,
  ready,
}: {
  value: Entry;
  change: (patch: Partial<Entry>) => void;
  ready: (ready: boolean) => void;
}) {
  const [auto, setAuto] = useState(true);
  const [pending, setPending] = useState<
    Partial<
      Record<
        "title" | "description",
        { from: "en" | "fr"; text: string; revision: number }
      >
    >
  >({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const versions = useRef({ title: 0, description: 0 });
  const callback = useRef(change);
  callback.current = change;
  const enabled = useRef(auto);
  enabled.current = auto;
  useEffect(() => {
    const missing: typeof pending = {};
    for (const key of ["title", "description"] as const) {
      const english = value[key];
      const french = value[(key + "Fr") as Field];
      if (!!english?.trim() !== !!french?.trim()) {
        const revision = ++versions.current[key];
        missing[key] = {
          from: english?.trim() ? "en" : "fr",
          text: english?.trim() ? english : french!,
          revision,
        };
      }
    }
    if (Object.keys(missing).length) setPending(missing);
  }, []);
  useEffect(() => {
    ready(!auto || !Object.keys(pending).length);
  }, [auto, pending, ready]);
  useEffect(() => {
    if (!auto || !Object.keys(pending).length) return;
    const timer = setTimeout(async () => {
      setStatus("Translating on the NVO server…");
      setError("");
      for (const [base, job] of Object.entries(pending)) {
        const key = base as "title" | "description";
        if (!job || versions.current[key] !== job.revision) continue;
        try {
          const result = await api("admin/translate", {
            text: job.text,
            from: job.from,
          });
          if (enabled.current && versions.current[key] === job.revision) {
            callback.current({
              [job.from === "en" ? key + "Fr" : key]: result.text,
            });
            setPending((old) => {
              const next = { ...old };
              if (next[key]?.revision === job.revision) delete next[key];
              return next;
            });
            setStatus(
              "Both languages are ready. You can refine either version.",
            );
          }
        } catch (e) {
          if (versions.current[key] === job.revision) {
            setError((e as Error).message);
            setStatus("");
          }
        }
      }
    }, 850);
    return () => clearTimeout(timer);
  }, [pending, auto]);
  function edit(field: Field, text: string) {
    callback.current({ [field]: text });
    const key = field.startsWith("title") ? "title" : "description";
    const revision = ++versions.current[key];
    setError("");
    if (!auto) return;
    if (!text.trim()) {
      callback.current({ [field.endsWith("Fr") ? key : key + "Fr"]: "" });
      setPending((old) => {
        const next = { ...old };
        delete next[key];
        return next;
      });
      return;
    }
    setStatus("The other language will update as you write…");
    setPending((old) => ({
      ...old,
      [key]: { text, from: field.endsWith("Fr") ? "fr" : "en", revision },
    }));
  }
  return (
    <div className="bilingual-editor">
      <div className="bilingual-header">
        <div>
          <Languages size={23} />
          <strong>Write once. Welcome guests in two languages.</strong>
        </div>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={auto}
            onChange={(ev) => {
              setAuto(ev.target.checked);
              versions.current.title++;
              versions.current.description++;
              setPending({});
              setStatus("");
              setError("");
            }}
          />
          Automatic translation
        </label>
      </div>
      <p className="form-note">
        Start in English or French. The other version follows automatically.
        Dish names and offers deserve a quick check before publishing.
      </p>
      <div className="form-row">
        {(["title", "titleFr"] as Field[]).map((field) => (
          <label key={field}>
            Title · {field.endsWith("Fr") ? "French" : "English"}
            <input
              aria-label={`Title · ${field.endsWith("Fr") ? "French" : "English"}`}
              required={field === "title" || auto}
              maxLength={160}
              value={value[field] || ""}
              onChange={(ev) => edit(field, ev.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="form-row">
        {(["description", "descriptionFr"] as Field[]).map((field) => (
          <label key={field}>
            Description · {field.endsWith("Fr") ? "French" : "English"}
            <textarea
              aria-label={`Description · ${field.endsWith("Fr") ? "French" : "English"}`}
              maxLength={5000}
              value={value[field] || ""}
              onChange={(ev) => edit(field, ev.target.value)}
            />
          </label>
        ))}
      </div>
      {status && (
        <p className="translation-status" role="status">
          {Object.keys(pending).length ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Check size={16} />
          )}{" "}
          {status}
        </p>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}{" "}
          <button type="button" onClick={() => setPending({ ...pending })}>
            Retry translation
          </button>
          <p>
            Or switch off automatic translation to finish both versions
            manually.
          </p>
        </div>
      )}
    </div>
  );
}
