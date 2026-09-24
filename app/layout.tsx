import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Anton, Anybody, Bebas_Neue, Dosis } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
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

export const metadata: Metadata = {
  title: "Dandy Studios",
  description: "Dandy Studios",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${tanker.variable} ${switzer.variable} ${dosis.variable} ${anton.variable} ${bebas.variable} ${anybody.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
