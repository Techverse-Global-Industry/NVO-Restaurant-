import { headers } from "next/headers";
import type { Language } from "./i18n";
export async function requestLanguage(): Promise<Language> {
  return (await headers()).get("x-nvo-language") === "fr" ? "fr" : "en";
}
