export type Language = "en" | "fr";
export function stripLanguage(path: string) {
  return path.replace(/^\/fr(?=\/|\?|#|$)/, "") || "/";
}
export function languagePath(path: string, lang: Language) {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /^\/(admin|api|_next|images|uploads|videos|fonts|social-media)(\/|$)/.test(
      path,
    )
  )
    return path;
  const clean = stripLanguage(path);
  return lang === "fr" ? "/fr" + (clean === "/" ? "" : clean) : clean;
}
export function entryText(
  entry: {
    title: string;
    titleFr?: string;
    description: string;
    descriptionFr?: string;
  },
  lang: Language,
) {
  return {
    title: lang === "fr" ? entry.titleFr || entry.title : entry.title,
    description:
      lang === "fr"
        ? entry.descriptionFr || entry.description
        : entry.description,
  };
}
