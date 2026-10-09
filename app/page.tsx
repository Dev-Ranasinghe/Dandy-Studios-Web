import Footer from "@/components/Footer";
import HeroSection from "@/components/sections/HeroSection";
import FrameGridSection from "@/components/sections/FrameGridSection";
import FeaturedWorkSection from "@/components/sections/FeaturedWorkSection";
import ClientsSection from "@/components/sections/ClientsSection";
import ListPreviewSection from "@/components/sections/ListPreviewSection";
import CutSection from "@/components/sections/CutSection";
import CrowdSection from "@/components/sections/CrowdSection";
import Testimonials from "@/components/sections/Testimonials";
import FocusSection from "@/components/sections/FocusSection";
import TreatmentsSection from "@/components/sections/TreatmentsSection";

export default function Home() {
  return (
    <>
      <main>
        <HeroSection />
        <TreatmentsSection />
        <FrameGridSection />
        <FeaturedWorkSection />
        <FocusSection />
        {/*
          One paper ground for these, so the plasma can bleed into its neighbours. It tucks under
          the footer's clear top band (--footer-lip), so the footer's tab rises out of this paper.
        */}
        <div className="relative isolate mb-[calc(-1*var(--footer-lip))] overflow-x-clip bg-[var(--bone)] pb-[var(--footer-lip)]">
          <ClientsSection />
          <ListPreviewSection />
          <Testimonials />
          <CrowdSection />
          <CutSection />
        </div>
      </main>
      <Footer />
    </>
  );
}
