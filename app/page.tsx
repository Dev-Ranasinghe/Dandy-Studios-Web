import Footer from "@/components/Footer";
import HeroSection from "@/components/sections/HeroSection";
import FrameGridSection from "@/components/sections/FrameGridSection";
import StudioSections from "@/components/sections/StudioSections";
import ManifestoSection from "@/components/sections/ManifestoSection";
import ListPreviewSection from "@/components/sections/ListPreviewSection";
import ServicesSection from "@/components/sections/ServicesSection";

export default function Home() {
  return (
    <>
      <main>
        <HeroSection />
        <FrameGridSection />
        <StudioSections />
        <ManifestoSection />
        <ListPreviewSection />
        <ServicesSection />
      </main>
      <Footer />
    </>
  );
}
