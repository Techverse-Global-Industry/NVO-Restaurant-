import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  images: { qualities: [60, 75] },
  // Keep metadata in the initial HTML, including correct 404 and noindex output.
  htmlLimitedBots: /.*/,
  serverExternalPackages: ["node:sqlite"],
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
