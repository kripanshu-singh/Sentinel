import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { QueryProvider } from "@/components/query-provider";
import { TourProvider } from "@/components/onboarding/tour-provider";
import "./globals.css";
import CommandPalette from "@/components/command-palette";
import { VideoModal } from "@/components/video-modal";
import { Analytics } from "@vercel/analytics/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://trysentinel-agent.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Sentinel — B2B Procurement Agent",
  description:
    "AI-powered B2B vendor order & discrepancy reconciliation agent. Execute procurement workflows with human-in-the-loop guardrails.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    title: "Sentinel",
  },
  openGraph: {
    title: "Sentinel — B2B Procurement Agent",
    description:
      "AI-powered B2B vendor order & discrepancy reconciliation agent. Execute procurement workflows with human-in-the-loop guardrails.",
    url: appUrl,
    siteName: "Sentinel",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Sentinel — B2B Procurement Agent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sentinel — B2B Procurement Agent",
    description:
      "AI-powered B2B vendor order & discrepancy reconciliation agent. Execute procurement workflows with human-in-the-loop guardrails.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="h-full">
        <QueryProvider>
          <TooltipProvider>
            <SidebarProvider defaultOpen={true}>
              <TourProvider>{children}</TourProvider>
              <CommandPalette />
              <VideoModal />
            </SidebarProvider>
          </TooltipProvider>
        </QueryProvider>
        <Analytics />
      {/* impeccable-live-start */}
<script async src="http://localhost:8400/live.js?token=cc645739-eb5e-48b7-a064-6461ccfec075"></script>
{/* impeccable-live-end */}
</body>
    </html>
  );
}
