import type { Metadata } from "next";
import Footer from "@/components/Footer";
import WorkHero from "@/components/sections/WorkHero";
import WorkBento from "@/components/sections/WorkBento";

export const metadata: Metadata = {
  title: "Work · Dandy Studios",
  description: "Websites, identities and motion from Dandy Studios.",
};

export default function WorkPage() {
  return (
    // One bone ground for the whole page, the footer's clear top band included.
    <div className="overflow-x-clip bg-[var(--bone)]">
      <main>
        <WorkHero />
        <WorkBento />
      </main>
      <Footer />
    </div>
  );
}
