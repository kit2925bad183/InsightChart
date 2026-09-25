import type { MetadataRoute } from "next";

// Makes InsightChart installable ("Add to Home Screen" / "Install app"). Served at
// /manifest.webmanifest and linked from every page automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "InsightChart — Assessment Analytics",
    short_name: "InsightChart",
    description: "Student assessment dashboards, comparisons and reports for college staff.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#2a78d6",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard" },
      { name: "Student Explorer", url: "/students" },
      { name: "Data Filter", url: "/filter" },
    ],
  };
}
