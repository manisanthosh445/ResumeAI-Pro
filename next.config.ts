import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
