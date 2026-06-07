/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // The question bank is imported at build time (see lib/questions.ts).
  // We tell Next.js to also trace the JSON in `data/` so the serverless bundle
  // includes it. (Without this, the import works in dev via fs but the
  // bundler may not know to copy the file in production.)
  outputFileTracingIncludes: {
    "**": ["./data/questions.json", "./scripts/**/*.{js,mjs}"],
  },
  // We do not actually need to fetch `data/questions.json` over HTTP — the
  // import is resolved at build time. So no rewrites are required. The
  // headers below are only useful if you later serve the file from `/public`.
  async headers() {
    return [
      {
        // If anyone later moves the file into /public and serves it as a
        // static asset, this gives it a long-lived, content-hashed cache
        // header. (The default is no caching for files in /public.)
        source: "/questions.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
