import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { BRAND } from "@/lib/brand";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: `${BRAND.name} - AI Social Media Scheduling`,
  description: BRAND.description,
  keywords: [
    "social media scheduler",
    "AI content generation",
    "AI captions",
    "open source",
    "instagram scheduler",
    "tiktok scheduler",
    "twitter scheduler",
    "linkedin scheduler",
    "social media management",
    "content scheduling",
    "AI campaign planner",
  ],
  authors: [{ name: "Zernio", url: "https://zernio.com" }],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: `${BRAND.name} - AI Social Media Scheduling`,
    description:
      "Generate captions, images, and videos with AI, then schedule across 13 platforms.",
    url: BRAND.url,
    siteName: BRAND.name,
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${BRAND.name} - AI Social Media Scheduling`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} - AI Social Media Scheduling`,
    description:
      "Generate captions, images, and videos with AI, then schedule across 13 platforms.",
    images: ["/og-image.png"],
  },
  metadataBase: new URL(BRAND.url),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${dmSans.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
