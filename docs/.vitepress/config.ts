import { defineConfig } from "vitepress";

export default defineConfig({
  title: "market-feed",
  description: "Unified TypeScript client for financial market data",
  base: "/market-feed/",

  head: [
    ["link", { rel: "icon", href: "/market-feed/favicon.ico" }],
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:title", content: "market-feed" }],
    ["meta", { name: "og:description", content: "Unified TypeScript client for financial market data" }],
  ],

  themeConfig: {
    logo: { light: "/logo-light.svg", dark: "/logo-dark.svg", alt: "market-feed" },

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/reference" },
      { text: "npm", link: "https://www.npmjs.com/package/market-feed" },
      {
        text: "v0.1.0",
        items: [
          { text: "Changelog", link: "https://github.com/piyushgupta344/market-feed/blob/main/CHANGELOG.md" },
          { text: "Contributing", link: "https://github.com/piyushgupta344/market-feed/blob/main/CONTRIBUTING.md" },
        ],
      },
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "What is market-feed?", link: "/guide/what-is-market-feed" },
          { text: "Getting Started", link: "/guide/getting-started" },
        ],
      },
      {
        text: "Core Concepts",
        items: [
          { text: "Providers", link: "/guide/providers" },
          { text: "Caching", link: "/guide/caching" },
          { text: "Fallback & Reliability", link: "/guide/fallback" },
          { text: "Error Handling", link: "/guide/errors" },
          { text: "Rate Limiting", link: "/guide/rate-limiting" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Custom Provider", link: "/guide/custom-provider" },
          { text: "Custom Cache Driver", link: "/guide/custom-cache" },
          { text: "Multi-Runtime", link: "/guide/runtimes" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "MarketFeed", link: "/api/market-feed" },
          { text: "Providers", link: "/api/providers" },
          { text: "Types", link: "/api/types" },
          { text: "Errors", link: "/api/errors" },
          { text: "Utilities", link: "/api/utilities" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/piyushgupta344/market-feed" },
      { icon: "npm", link: "https://www.npmjs.com/package/market-feed" },
    ],

    search: { provider: "local" },

    editLink: {
      pattern: "https://github.com/piyushgupta344/market-feed/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 market-feed contributors",
    },
  },
});
