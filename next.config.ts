import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Listing photos are served straight from Firebase Storage; next/image
    // generates the responsive AVIF/WebP srcset, so no second stored thumbnail.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
    // Note for anyone debugging locally: with the Storage emulator, uploaded
    // images render broken. The emulator hands out http://127.0.0.1:9199 URLs
    // and Next 16's optimizer refuses loopback upstreams outright — adding a
    // remotePattern for it does not help, it is blocked a layer below. Nothing
    // to fix; production URLs are on firebasestorage.googleapis.com.
    // Next 16 ships [75] only. 65 is for grid thumbnails, where the smaller
    // payload matters more than the detail on a mobile connection.
    qualities: [65, 75],
  },
};

export default nextConfig;
