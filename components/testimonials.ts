/**
 * Client testimonials for the home page's crowd section.
 *
 * PLACEHOLDERS ONLY. Every entry below is marked as a placeholder on purpose: never ship
 * invented quotes, names or companies (see PRODUCT.md). Replace each with a real client's
 * words and details, with their permission. `photo` is optional (a square image in
 * /public/images/clients/); without it the card shows the person's initials.
 */

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  photo?: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Placeholder quote. A client describes what it was like to work with the studio from the first call to launch day: how the brief was understood, how quickly ideas turned into something they could see, and why they would happily do it all again on the next project.",
    name: "Client name",
    role: "Role",
    company: "Company",
  },
  {
    quote:
      "Placeholder quote. Use this longer slot for the full story: where the project started and what wasn't working, what the studio brought to the table, how the new site or identity came together, how it landed with their audience after launch, and what they would tell someone still deciding whether to hire the studio. Real testimonials often run this long, so the card is built to hold it.",
    name: "Client name",
    role: "Role",
    company: "Company",
  },
  {
    quote:
      "Placeholder quote. A short, punchy line from a happy client about the quality of the work and the speed it arrived. Something they would say to a friend without being asked.",
    name: "Client name",
    role: "Role",
    company: "Company",
  },
  {
    quote:
      "Placeholder quote. A mid-length testimonial about the design, the build and the collaboration, in the client's own words: how clear the communication was, how every round of feedback was handled, and how the final result felt more considered than they expected.",
    name: "Client name",
    role: "Role",
    company: "Company",
  },
  {
    quote:
      "Placeholder quote. Something specific about the result: a launch that went smoothly, a rebrand their team finally felt proud of, the reaction from their customers in the first week, or a number that moved once the new site went live.",
    name: "Client name",
    role: "Role",
    company: "Company",
  },
  {
    quote:
      "Placeholder quote. A client on the details: the motion, the typography, the small interactions nobody asked for but everyone noticed, and how it made their brand feel like itself for the first time.",
    name: "Client name",
    role: "Role",
    company: "Company",
  },
];
