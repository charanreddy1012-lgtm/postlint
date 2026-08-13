import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "@derhuerst/ffprobe-static"],
  outputFileTracingIncludes: {
    "/api/preflight": [
      "node_modules/ffmpeg-static/ffmpeg*",
      "node_modules/@derhuerst/ffprobe-static/ffprobe*",
    ],
  },
};

export default nextConfig;
