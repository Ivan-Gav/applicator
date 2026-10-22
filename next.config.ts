import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A document upload: a file of up to 4 MiB (maxDocumentFileBytes) and the
      // multipart overhead around it. Vercel refuses request bodies over 4.5 MB.
      bodySizeLimit: "4.2mb",
    },
  },
};

export default nextConfig;
