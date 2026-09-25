import type { MetadataRoute } from "next";

// Everything is behind sign-in; the public sign-in page doesn't need indexing either.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
