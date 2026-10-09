/**
 * The work index: categories for the /work sidebar and the pieces in its grid.
 *
 * Clips are the 720p local transcodes in public/video/grid/ (the original CDN files ran 3–26 MB).
 *
 * STAND-IN CONTENT. These entries reuse the showcase clips already on the home page's frame
 * grid, with neutral, descriptive titles; they are not client projects. Replace each entry
 * with a real project (title, disciplines, year, media) when case studies are ready. Never
 * name a client here that has not agreed to be named (see PRODUCT.md).
 */

export type WorkCategory = {
  id: string;
  label: string;
  /** Shown in the sidebar but not selectable yet. */
  comingSoon?: boolean;
};

export const WORK_CATEGORIES: WorkCategory[] = [
  { id: "all", label: "All work" },
  { id: "web", label: "Web design" },
  { id: "dev", label: "Development" },
  { id: "motion", label: "Motion" },
  { id: "art", label: "Art direction" },
  { id: "brand", label: "Brand identity", comingSoon: true },
  { id: "cases", label: "Case studies", comingSoon: true },
];

export type WorkPiece = {
  id: string;
  title: string;
  /** Category ids; the first reads as the piece's main discipline. */
  categories: string[];
  poster: string;
  video: string;
};

export const WORK: WorkPiece[] = [
  {
    id: "001",
    title: "Portrait loop",
    categories: ["motion", "art"],
    poster: "/images/work/01.jpg",
    video: "/video/grid/01.mp4",
  },
  {
    id: "002",
    title: "Launch page",
    categories: ["web", "motion"],
    poster: "/images/work/02.jpg",
    video: "/video/grid/02.mp4",
  },
  {
    id: "003",
    title: "Poster study",
    categories: ["art"],
    poster: "/images/work/03.jpg",
    video: "/video/grid/03.mp4",
  },
  {
    id: "004",
    title: "Campaign page",
    categories: ["web", "art"],
    poster: "/images/work/04.jpg",
    video: "/video/grid/04.mp4",
  },
  {
    id: "005",
    title: "Folding form",
    categories: ["motion", "dev"],
    poster: "/images/work/05.jpg",
    video: "/video/grid/05.mp4",
  },
  {
    id: "006",
    title: "Style picker",
    categories: ["dev", "web"],
    poster: "/images/work/06.jpg",
    video: "/video/grid/06.mp4",
  },
  {
    id: "007",
    title: "Storyboard UI",
    categories: ["web", "motion"],
    poster: "/images/work/07.jpg",
    video: "/video/grid/07.mp4",
  },
  {
    id: "008",
    title: "Couture film",
    categories: ["art", "motion"],
    poster: "/images/work/08.jpg",
    video: "/video/grid/08.mp4",
  },
  {
    id: "009",
    title: "Pricing card",
    categories: ["dev", "web"],
    poster: "/images/work/09.jpg",
    video: "/video/grid/09.mp4",
  },
];

export const categoryLabel = (id: string) => WORK_CATEGORIES.find((c) => c.id === id)?.label ?? id;
