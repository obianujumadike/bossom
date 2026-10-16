import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
};

const isDev = process.env.NODE_ENV === "development";
const disablePWA = isDev && process.env.DISABLE_PWA !== "false";

export default withPWA({
  dest: "public",
  // The default PWA rules cache pages, RSC payloads, /api responses and
  // cross-origin requests (signed mammogram URLs). A cached page could then
  // render a previous user's dashboard after sign-out, so anything that can
  // carry patient data is network-only; offline navigation gets /offline.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  extendDefaultRuntimeCaching: true,
  fallbacks: {
    document: "/offline",
  },
  // PWA disabled in development by default, but can be enabled with DISABLE_PWA=false
  disable: disablePWA,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ sameOrigin, url: { pathname } }) => sameOrigin && pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: { cacheName: "apis" },
      },
      {
        urlPattern: ({ request, sameOrigin, url: { pathname } }) =>
          request.headers.get("RSC") === "1" && sameOrigin && !pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: { cacheName: "pages-rsc" },
      },
      {
        urlPattern: ({ request, sameOrigin, url: { pathname } }) =>
          request.headers.get("RSC") === "1" && request.headers.get("Next-Router-Prefetch") === "1" && sameOrigin && !pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: { cacheName: "pages-rsc-prefetch" },
      },
      {
        urlPattern: ({ request, sameOrigin, url: { pathname } }) =>
          sameOrigin && request.mode === "navigate" && !pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: { cacheName: "pages" },
      },
      {
        urlPattern: ({ sameOrigin }) => !sameOrigin,
        handler: "NetworkOnly",
        options: { cacheName: "cross-origin" },
      },
    ],
  },
})(nextConfig);
