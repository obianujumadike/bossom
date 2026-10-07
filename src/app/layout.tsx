import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ReactNode } from "react";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/lib/convex/ConvexClientProvider";
import { AuthProvider } from "@/lib/auth/context";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Bossom - AI-Powered Mammogram Analysis",
  description: "Advanced AI-powered mammogram analysis platform for healthcare professionals",
  generator: "Next.js",
  manifest: "/manifest.json",
  keywords: ["bossom", "mammogram", "AI", "medical imaging", "healthcare", "nextjs", "pwa"],
  authors: [
    { name: "Bossom Team" },
  ],
  icons: [
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png", sizes: "180x180" },
    { rel: "icon", url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    { rel: "icon", url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1f2937" },
    { media: "(prefers-color-scheme: light)", color: "#ED205A" },
  ],
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    // inMemory: the access token is never written to localStorage; the
    // refresh token lives only in an httpOnly cookie.
    <ConvexAuthNextjsServerProvider storage="inMemory" shouldHandleCode={false}>
      <html lang="en">
        <head>
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Bossom" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="msapplication-TileColor" content="#ED205A" />
          <meta name="msapplication-tap-highlight" content="no" />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ConvexClientProvider>
            <AuthProvider>
              {children}
              <ToastContainer
                position="top-right"
                autoClose={4000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
                toastClassName="!rounded-xl !shadow-lg !text-sm !font-medium"
              />
            </AuthProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
