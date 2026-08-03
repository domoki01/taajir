import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Listing photos are served straight from Firebase Storage; next/image
    // generates the responsive AVIF/WebP srcset, so no second stored thumbnail.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
    // Next 16 ships [75] only. 65 is for grid thumbnails, where the smaller
    // payload matters more than the detail on a mobile connection.
    qualities: [65, 75],
  },
};

export default nextConfig;
