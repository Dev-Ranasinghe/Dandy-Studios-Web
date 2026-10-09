/**
 * The work index: categories for the /work sidebar and the pieces in its grid.
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
    video: "https://cdn.21st.dev/assets/mirror/c7/c72edad406566d06615b8c711782465a1974f0f3b0b439b7347edc3974a9e215.mp4",
  },
  {
    id: "002",
    title: "Launch page",
    categories: ["web", "motion"],
    poster: "/images/work/02.jpg",
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/WebGL%20Exported%20(1).mp4",
  },
  {
    id: "003",
    title: "Poster study",
    categories: ["art"],
    poster: "/images/work/03.jpg",
    video: "https://cdn.21st.dev/assets/mirror/dc/dc9c6324746faed48effd0f84ee38fa1398ffc426baada0ee69e04b530e3c7d8.mp4",
  },
  {
    id: "004",
    title: "Campaign page",
    categories: ["web", "art"],
    poster: "/images/work/04.jpg",
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/Exported%20Web%20Video.mp4",
  },
  {
    id: "005",
    title: "Folding form",
    categories: ["motion", "dev"],
    poster: "/images/work/05.jpg",
    video: "https://cdn.21st.dev/assets/mirror/26/2656819e535252d98acaac11e3130e52b0bb6d7d7b0d53cac2cdc002b29cd282.mp4",
  },
  {
    id: "006",
    title: "Style picker",
    categories: ["dev", "web"],
    poster: "/images/work/06.jpg",
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/Animation%20Exported%20(4).mp4",
  },
  {
    id: "007",
    title: "Storyboard UI",
    categories: ["web", "motion"],
    poster: "/images/work/07.jpg",
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/Illustration%20Exported%20(1).mp4",
  },
  {
    id: "008",
    title: "Couture film",
    categories: ["art", "motion"],
    poster: "/images/work/08.jpg",
    video: "https://static.cdn-luma.com/files/58ab7363888153e3/Art%20Direction%20Exported.mp4",
  },
  {
    id: "009",
    title: "Pricing card",
    categories: ["dev", "web"],
    poster: "/images/work/09.jpg",
    video: "https://cdn.21st.dev/assets/mirror/9a/9a94d5bc6d8a6dd70732a1b4938e233bd201da7761226abab9f2e618814b9c1b.mp4",
  },
];

export const categoryLabel = (id: string) => WORK_CATEGORIES.find((c) => c.id === id)?.label ?? id;
