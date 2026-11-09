import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// F.1/W.03: the Markdown copies of the three PDFs are the working source of truth
// (CLAUDE.md reads docs/*.md first), so their structure and key facts are guarded here.

const root = new URL("../../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), "utf8");

// Fenced code blocks (bash comments, the CLAUDE.md template) contain "# " lines that are not headings.
const withoutCodeBlocks = (markdown: string): string => markdown.replace(/^```[\s\S]*?^```/gm, "");

const headingLines = (markdown: string): Set<string> =>
  new Set(
    withoutCodeBlocks(markdown)
      .split("\n")
      .filter((line) => /^#{1,4} /.test(line))
      .map((line) => line.replace(/^#{1,4} /, "").trim()),
  );

interface DocCase {
  file: string;
  title: string;
  headings: string[];
  facts: string[];
}

const docs: DocCase[] = [
  {
    file: "docs/plan.md",
    title: "Midnight to Dawn — Director's Implementation Plan",
    headings: [
      "How this plan works",
      "Order of work",
      "Naming",
      "Working with Claude Code",
      "Story bible",
      "The cast",
      "Blender-to-web parity rules",
      "Foundation",
      "F.1 Project setup",
      "F.2 Blender settings and scripts",
      "F.3 Core web systems",
      "F.4 Test harness",
      "Cast build",
      "The character template (repeat per character)",
      "Build order and budgets",
      "Shared props library",
      "Act 0 — Breath (Loading)",
      "Act 1 — The Fall (Home page)",
      "Act 2 — The Quiet Room (About page)",
      "Transition 2→3 — The Floor Opens",
      "Act 3 — The Battlefield (Skills page)",
      "The Pillar sequence (repeat per Pillar)",
      "Act 4 — The Upper Ranks (Projects page)",
      "The fight sequence (repeat per rank)",
      "Act 5 — The Demon King (Experience page)",
      "The phase sequence (repeat per experience entry)",
      "Act 6 — Dawn (the transition from castle to mansion)",
      "Act 7 — The Mansion (Contact page)",
      "Final assembly",
      "T0→1 · Through the door",
      "1.5 · Racing the Door",
      "3.5 / T3→4 · Double Drum: The Ascent",
      "5.7 · The Castle Falls Apart",
      "Z.6 · Launch",
    ],
    facts: [
      "**Done when:** a test cube scene exports from Blender, plays in the browser through the Director, and passes the parity test.",
      "pass = similarity 0.90 or higher",
      "`3K-A` for Kaname's P.A, `4R6-D` for Rank Six's R.D",
      "marker `3<P>-A`",
    ],
  },
  {
    file: "docs/tdd.md",
    title: "Midnight to Dawn — Technical Design Document",
    headings: [
      "Overview",
      "Goals",
      "Success targets",
      "Tech stack",
      "Architecture",
      "Project structure",
      "Core systems",
      "1. Director",
      "2. Shot data format",
      "10. Store (Zustand)",
      "Content data model",
      "Scene specs per act",
      "Shaders and VFX catalog",
      "Asset pipeline",
      "Characters",
      "Environments",
      "Export settings and formats",
      "Art sourcing",
      "Performance",
      "Budgets per quality tier",
      "Rules Claude Code must follow",
      "Accessibility, fallbacks and SEO",
      "Contact backend and security",
      "Testing and deployment",
      "Build plan for Claude Code",
      "Milestones",
      "How to run each session",
    ],
    facts: [
      "interface ActModule {",
      "| Draw calls per frame | 200 | 140 | 80 |",
      "The whole film needs 16 effects",
      "| M0 | Setup |",
    ],
  },
  {
    file: "docs/screenplay.md",
    title: "Midnight to Dawn — Demon Slayer Portfolio Screenplay",
    headings: [
      "Director's vision",
      "Story bible",
      "Act 0 — Breath (Loading screen)",
      "Act 1 — The Fall (Home page)",
      "Act 2 — The Quiet Room (About page)",
      "Act 3 — The Battlefield (Skills page)",
      "Act 4 — The Upper Ranks (Projects page)",
      "Act 5 — The Demon King (Experience page)",
      "Act 6 — Dawn (transition)",
      "Act 7 — The Mansion (Contact page)",
      "Shot 1.7 — Slow Motion: The Name (scroll 60–70%)",
      "Shot 4.D — The Final Blow (visitor's turn)",
      "Production notes",
    ],
    facts: [
      "A lone swordsman falls into an endless castle, finds a moment of calm, fights beside the Pillars, defeats the strongest demons and their King, and wakes at dawn to leave a message for whoever came along for the ride.",
    ],
  },
];

describe.each(docs)("$file", ({ file, title, headings, facts }) => {
  const markdown = read(file);
  const found = headingLines(markdown);

  it("starts with the document title as its only H1", () => {
    expect(markdown.split("\n")[0]).toBe(`# ${title}`);
    expect(withoutCodeBlocks(markdown).match(/^# /gm)).toHaveLength(1);
  });

  it.each(headings)("has the PDF section heading %s", (heading) => {
    expect(found.has(heading), `missing heading "${heading}" in ${file}`).toBe(true);
  });

  it.each(facts)("keeps the exact text: %s", (fact) => {
    expect(markdown.includes(fact), `missing text in ${file}: ${fact}`).toBe(true);
  });

  it("has no PDF print artefacts (page footers or running headers)", () => {
    expect(markdown).not.toMatch(/Page \d+ of \d+/);
    const runningHeaders = markdown.split("\n").filter((line) => line.trim() === title);
    expect(runningHeaders).toEqual([]);
  });

  it("ends with conversion notes", () => {
    expect(found.has("Conversion notes")).toBe(true);
  });
});

describe("docs/images", () => {
  const images = [
    { image: "images/plan-shot-loop.png", doc: "docs/plan.md" },
    { image: "images/tdd-system-architecture.png", doc: "docs/tdd.md" },
  ];

  it.each(images)("$image exists and is embedded only in $doc", ({ image, doc }) => {
    expect(existsSync(new URL(`docs/${image}`, root))).toBe(true);
    for (const { file } of docs) {
      const embeds = read(file).includes(`](${image})`);
      expect(embeds, `${file} embedding ${image}`).toBe(file === doc);
    }
  });
});

describe("docs/progress.md", () => {
  const progress = read("docs/progress.md");

  it("has the Done, Next and Open issues sections", () => {
    for (const section of ["## Done", "## Next", "## Open issues"]) {
      expect(progress).toContain(section);
    }
  });

  it("lists the shipped Foundation items under Done", () => {
    const done = progress.split("## Done")[1]?.split("## Next")[0] ?? "";
    expect(done).toContain("F.1/W.01");
    expect(done).toContain("F.1/W.02");
  });
});
