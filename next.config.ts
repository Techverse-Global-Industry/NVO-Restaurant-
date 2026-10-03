import type { NextConfig } from "next";
const storageHost = (() => {
  try {
    const url = new URL(process.env.NVO_SUPABASE_URL || "");
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co")
      ? url.hostname
      : null;
  } catch {
    return null;
  }
})();
const config: NextConfig = {
  poweredByHeader: false,
  images: {
    qualities: [60, 75],
    remotePatterns: storageHost
      ? [{ protocol: "https", hostname: storageHost, pathname: "/storage/v1/object/public/nvo-media/**" }]
      : [],
  },
  // Keep metadata in the initial HTML, including correct 404 and noindex output.
  htmlLimitedBots: /.*/,
  serverExternalPackages: ["node:sqlite", "pg"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
