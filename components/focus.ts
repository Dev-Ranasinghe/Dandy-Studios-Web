/**
 * Content for the home page's focus section (components/sections/FocusSection.tsx): the three
 * package tickets, the desktop's files, and the FAQ.
 *
 * PLACEHOLDERS. Package scope and prices are stand-ins until the studio confirms its real
 * offer (PRODUCT.md: never invent numbers); every price reads "On request" for now. Photos
 * reuse the site's own stills; the testimonials window reads components/testimonials.ts.
 */

/** Rich text: plain strings, or `{ em }` runs set in the italic serif. */
export type Rich = (string | { em: string })[];

export type Package = {
  id: string;
  name: string;
  pitch: Rich;
  features: Rich[];
  price: string;
  /** Printed under the barcode: one line on why the studio works this way. */
  motto: string;
};

export const PACKAGES: Package[] = [
  {
    id: "essentials",
    name: "Essentials",
    pitch: ["Your early presence, made sharp: a credible site built to ", { em: "launch fast" }, " and ", { em: "run smoothly" }, "."],
    features: [["A focused site of a few pages"], ["Custom visual direction"], ["Built and tuned for speed"]],
    price: "On request",
    motto: "Ideas are never recycled",
  },
  {
    id: "growth",
    name: "Growth",
    pitch: ["You already have momentum. Now we ", { em: "remove the friction" }, ": a structured system that keeps you ", { em: "moving forward" }, "."],
    features: [["Multi-page site ", { em: "+ a CMS you can edit" }], ["Complete brand identity"], ["Integrations with your tools"]],
    price: "On request",
    motto: "Designed and built by one person",
  },
  {
    id: "signature",
    name: "Signature",
    pitch: ["For brands that want the site ", { em: "to be the experience" }, ": motion, interaction and craft, ", { em: "end to end" }, "."],
    features: [["Full design system"], ["Custom motion ", { em: "+ interaction" }], ["Ongoing care after launch"]],
    price: "On request",
    motto: "A direct line to the person building it",
  },
];

export type DesktopPhoto = { id: string; file: string; src: string; title: string; role: string };

// Stand-ins: the founder portrait plus two of the site's work stills.
export const PHOTOS: DesktopPhoto[] = [
  { id: "dandy", file: "Dandy.png", src: "/images/focus/dandy.jpg", title: "Dandy", role: "Design & Development" },
  { id: "desk", file: "Desk.jpg", src: "/images/work/03.jpg", title: "Desk", role: "Placeholder" },
  { id: "process", file: "Process.jpg", src: "/images/work/05.jpg", title: "Process", role: "Placeholder" },
];

/** FAQ.md, shown line-numbered in the desktop's text window. Generic answers only. */
export const FAQ_MD = `# What do you work on?

Websites, from the first
sketch to the last line of
code: art direction, UI/UX,
motion, branding and front-end
development.

---

# Who will I be working with?

Me. Dandy Studios is a studio
of one, so the person you
brief is the person who
designs and builds your site.
No hand-offs, no account
managers.

---

# Do you offer branding?

Yes. From a light visual
direction to a complete
identity, depending on what
the project needs.

---

# How does a project start?

With a free call. We talk
through your goals, your
audience and your timeline,
then I send a written
proposal.

---

# What does a project cost?

Every project is quoted on its
scope. Packages are a starting
point; the proposal lists
exactly what is included.

---

# What happens after launch?

You get a site you can run
yourself. Ongoing care is
available if you want someone
keeping it sharp.

---

# Is every site responsive?

Always. Every package is
responsive, fast, accessible,
tested across browsers and
built on clean code. Quality
is non-negotiable.
`;
