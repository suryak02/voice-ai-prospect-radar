import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { siteUrl } from "@/lib/site-url";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Voice AI Prospect Radar";
const description =
  "Gated geospatial prospect intelligence dashboard for Voice AI teams, with explainable lead scoring, territory filtering, and review workflows.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s | ${title}`,
  },
  description,
  keywords: [
    "Voice AI",
    "prospect intelligence",
    "lead scoring",
    "geospatial dashboard",
    "Google Places",
    "Next.js",
    "Prisma",
    "Supabase",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: title,
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var light=t==='light';var c=document.documentElement.classList;c.toggle('light',light);c.toggle('dark',!light);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
