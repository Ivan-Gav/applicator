import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // radix-ui re-exports every primitive from one entry; not in Next.js's default list.
    optimizePackageImports: ["radix-ui"],
    serverActions: {
      // A document upload: a file of up to 4 MiB (maxDocumentFileBytes) and the
      // multipart overhead around it. Vercel refuses request bodies over 4.5 MB.
      bodySizeLimit: "4.2mb",
    },
  },
};

export default nextConfig;
