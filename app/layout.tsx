import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { Anton, Anybody, Bebas_Neue, Dosis, Libre_Caslon_Display, Libre_Caslon_Text, Work_Sans } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import ScrollState from "@/components/ScrollState";
import SmoothScroll from "@/components/SmoothScroll";
import RecordingHud from "@/components/RecordingHud";
import { ACCENT_BOOT } from "@/lib/accent-palette";
import "./globals.css";

const tanker = localFont({
  src: "./fonts/Tanker-Regular.woff2",
  weight: "400",
  display: "block",
  variable: "--font-display",
});

const switzer = localFont({
  src: "./fonts/Switzer-Medium.woff2",
  weight: "500",
  display: "swap",
  variable: "--font-text",
});

// Studio sections: Dosis is the reference's exact text face. Anton and Bebas Neue
// stand in for Harber and Early Edition JNL until licensed files are added (see globals.css).
const dosis = Dosis({ subsets: ["latin"], weight: "600", display: "swap", variable: "--font-dosis" });
const anton = Anton({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-anton" });
// Menu: a variable face with a width axis runs from Gunter-like hairline condensed
// to the reference's wide "long letter" alternates (the originals are licensed faces).
const anybody = Anybody({ subsets: ["latin"], axes: ["wdth"], display: "swap", variable: "--font-anybody" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-bebas" });

// Statement + clients: a high-contrast display serif over a quiet grotesk label.
const caslon = Libre_Caslon_Display({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-serif" });
// The display cut has no italic; its text sibling supplies one for emphasis (focus section, tickets).
const caslonItalic = Libre_Caslon_Text({ subsets: ["latin"], weight: "400", style: "italic", display: "swap", variable: "--font-serif-italic" });
// Kept loaded as --font-worksans; the label face (--font-label) now points at Tanker, see globals.css.
const workSans = Work_Sans({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-worksans" });

export const metadata: Metadata = {
  title: "Dandy Studios",
  description: "Dandy Studios",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${tanker.variable} ${switzer.variable} ${dosis.variable} ${anton.variable} ${bebas.variable} ${anybody.variable} ${caslon.variable} ${caslonItalic.variable} ${workSans.variable}`}>
      <body>
        {/*
          Applies the visitor's saved accent before first paint. Next injects it into <head> outside
          React's hydration, so browser extensions that add their own head scripts can't cause a
          hydration mismatch against it.
        */}
        <Script id="accent-boot" strategy="beforeInteractive">
          {ACCENT_BOOT}
        </Script>
        <ScrollState />
        <SmoothScroll />
        <SiteHeader />
        {children}
        <RecordingHud />
      </body>
    </html>
  );
}
