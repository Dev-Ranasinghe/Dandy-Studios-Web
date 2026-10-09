import type { Metadata } from "next";
import NotFoundSection from "@/components/sections/NotFoundSection";

export const metadata: Metadata = {
  title: "Not found · Dandy Studios",
  description: "This page hasn't been built yet.",
};

/** Every route that doesn't exist yet (About, Articles, Contact, typos) lands here. */
export default function NotFound() {
  return (
    <main>
      <NotFoundSection />
    </main>
  );
}
