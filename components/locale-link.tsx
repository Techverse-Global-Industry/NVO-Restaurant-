"use client";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useNvo } from "./provider";
import { languagePath } from "@/lib/i18n";

export default function Link({
  href,
  prefetch = false,
  ...props
}: ComponentProps<typeof NextLink>) {
  const { lang } = useNvo();
  return (
    <NextLink
      {...props}
      prefetch={prefetch}
      href={typeof href === "string" ? languagePath(href, lang) : href}
    />
  );
}
