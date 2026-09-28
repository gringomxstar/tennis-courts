import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TC Marly",
    short_name: "TC Marly",
    description: "Tennisplätze des Tennis Club Marly reservieren",
    start_url: "/c/tc-marly",
    display: "standalone",
    background_color: "#0b0f17",
    theme_color: "#0b0f17",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
