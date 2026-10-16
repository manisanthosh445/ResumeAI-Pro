import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "tesseract.js"],
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
