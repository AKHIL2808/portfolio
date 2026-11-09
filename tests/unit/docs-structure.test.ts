import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  planActs,
  planFinal,
  planSequenceSteps,
  planShots,
  screenplayShots,
} from "./docs-headings.data";

// F.1/W.03 Done when: "each .md contains every section heading of its PDF".
// Complements docs.test.ts (subset spot checks) with the complete heading lists, per-shot block
// counts, table rows, the untouched PDFs and the progress log layout.

const root = new URL("../../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), "utf8");
const withoutCodeBlocks = (markdown: string): string => markdown.replace(/^```[\s\S]*?^```/gm, "");

interface Heading {
  level: number;
  text: string;
}
const headings = (markdown: string): Heading[] =>
  withoutCodeBlocks(markdown)
    .split("\n")
    .map((line) => /^(#{1,6}) (.*\S)\s*$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ level: (m[1] ?? "").length, text: m[2] ?? "" }));

const levelOf = (list: Heading[], text: string): number[] =>
  list.filter((h) => h.text === text).map((h) => h.level);

const tableRows = (markdown: string, heading: string, firstCell: RegExp): string[] => {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^#{2,4} /.test(l) && l.replace(/^#+ /, "").trim() === heading);
  expect(start, `heading "${heading}" not found`).toBeGreaterThanOrEqual(0);
  const rows: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (/^#{1,4} /.test(line)) break;
    if (line.startsWith("|") && firstCell.test(line.split("|")[1]?.trim() ?? "")) rows.push(line);
  }
  return rows;
};

describe("docs/plan.md complete structure", () => {
  const md = read("docs/plan.md");
  const list = headings(md);
  const actHeadings = [...planActs, "Transition 2→3 — The Floor Opens", "Final assembly"];

  it("PDF transcription sanity: 46 numbered shot/transition headings plus 3.5 / T3→4", () => {
    // 47 lines match the ' · ' pattern: 46 shots/transitions + the combined 3.5 / T3→4 line
    expect(planShots).toHaveLength(47);
    expect(planSequenceSteps).toHaveLength(18);
    expect(planFinal).toHaveLength(6);
  });

  it.each(actHeadings)("has H2 %s", (text) => {
    expect(levelOf(list, text), `"${text}" should be an H2`).toContain(2);
  });

  it.each(planShots)("has H3 shot heading %s", (text) => {
    expect(levelOf(list, text), `"${text}" should be an H3`).toContain(3);
  });

  it.each(planFinal)("has H3 final assembly heading %s", (text) => {
    expect(levelOf(list, text)).toContain(3);
  });

  it.each(planSequenceSteps)("has H4 sequence step %s", (text) => {
    expect(levelOf(list, text), `"${text}" should be an H4`).toContain(4);
  });

  it("keeps the PDF's per-shot block counts (47 Build in Blender, 47 Code, 38 Test)", () => {
    const count = (name: string): number => list.filter((h) => h.level === 4 && h.text === name).length;
    expect(count("Build in Blender")).toBe(47);
    expect(count("Code")).toBe(47);
    expect(count("Test")).toBe(38);
  });

  it("puts every Build in Blender / Code / Test block under a shot or transition heading", () => {
    let current: Heading | undefined;
    const orphans: string[] = [];
    for (const h of list) {
      if (h.level <= 3) current = h;
      if (h.level === 4 && ["Build in Blender", "Code", "Test"].includes(h.text)) {
        if (!current || !planShots.includes(current.text)) orphans.push(`${h.text} under ${current?.text ?? "nothing"}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it("lists the six Pillars, six Ranks and nine build-order rows", () => {
    expect(tableRows(md, "Pillar list", /^[1-6]$/)).toHaveLength(6);
    expect(tableRows(md, "Rank list", /^[1-6]$/)).toHaveLength(6);
    expect(tableRows(md, "Build order and budgets", /^[1-9]$/)).toHaveLength(9);
  });

  it("names the six Pillars and the six Upper Rank demons", () => {
    for (const name of ["Kaname Hebiishi", "Minato Sazanami", "Kiri Shizuku", "Homura Akane", "Hibiki Narukami", "Iwao Kanemori"]) {
      expect(md).toContain(name);
    }
    for (const name of ["The Endless Inbox", "The Tangled Web", "The Wrong Measure", "The Faceless Crowd", "The Slow Machine", "The Market Storm"]) {
      expect(md).toContain(name);
    }
  });

  it("mentions ElementTrail in its conversion notes", () => {
    const notes = md.split(/^## Conversion notes/m)[1] ?? "";
    expect(notes).toContain("ElementTrail");
  });
});

describe("docs/tdd.md complete structure", () => {
  const md = read("docs/tdd.md");
  const list = headings(md);
  const h2 = [
    "Overview", "Goals", "Success targets", "In scope", "Out of scope for version 1", "Tech stack",
    "Architecture", "Project structure", "Core systems", "Content data model", "Scene specs per act",
    "Shaders and VFX catalog", "Asset pipeline", "Characters", "Environments",
    "Export settings and formats", "Art sourcing", "Performance", "Accessibility, fallbacks and SEO",
    "Contact backend and security", "Testing and deployment", "Build plan for Claude Code",
    "Milestones", "How to run each session",
  ];
  const h3 = [
    "Authoring (Blender side)", "Runtime (browser side)",
    "1. Director", "2. Shot data format", "3. Camera rig", "4. Time system (slow motion)",
    "5. Scroll system", "6. Input system", "7. Audio system", "8. Asset manager",
    "9. Quality system", "10. Store (Zustand)",
    "Act 0 — Breath", "Act 1 — The Fall", "Act 2 — The Quiet Room", "Act 3 — The Battlefield",
    "Act 4 — The Upper Ranks", "Act 5 — The Demon King", "Act 6 — Dawn", "Act 7 — The Mansion",
    "The Blender-first workflow (repeat per act)", "Claude Code + Blender",
    "Budgets per quality tier", "Rules Claude Code must follow",
    "Recruiter page (`/cv`)", "Automatic fallbacks", "Accessibility checklist", "Mobile",
    "CLAUDE.md (copy into the repository root)",
  ];

  it.each(h2)("has H2 %s", (text) => {
    expect(levelOf(list, text), `"${text}" should be an H2`).toContain(2);
  });

  it.each(h3)("has H3 %s", (text) => {
    expect(levelOf(list, text), `"${text}" should be an H3`).toContain(3);
  });

  it("keeps Core systems 1 to 10 in order", () => {
    const core = list.filter((h) => h.level === 3 && /^\d+\. /.test(h.text)).map((h) => h.text.split(".")[0]);
    expect(core).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("keeps the VFX catalog as 16 effect rows with the 16 names", () => {
    const rows = tableRows(md, "Shaders and VFX catalog", /^[A-Za-z]/).filter((r) => !/^\|\s*Effect\s*\|/.test(r));
    const names = rows.map((r) => (r.split("|")[1] ?? "").trim());
    expect(names).toEqual([
      "ToonMaterial", "InkOutline", "VATCrowd", "StrokeReveal", "InkRibbon", "InkRing", "Dissolve",
      "ParticleMorph", "LanternField", "WindSway", "RingRipple", "ElementBurst", "ScreenSplit (post)",
      "SpeedLines (post)", "Bloom + Vignette (post)", "SunriseGrade + Eyelid (post)",
    ]);
  });

  it("keeps the Milestones table M0 to M11", () => {
    const rows = tableRows(md, "Milestones", /^M\d+$/);
    expect(rows.map((r) => (r.split("|")[1] ?? "").trim())).toEqual(
      Array.from({ length: 12 }, (_, i) => `M${i}`),
    );
  });

  it("mentions ElementTrail in its conversion notes", () => {
    expect(md.split(/^## Conversion notes/m)[1] ?? "").toContain("ElementTrail");
  });
});

describe("docs/screenplay.md complete structure", () => {
  const md = read("docs/screenplay.md");
  const list = headings(md);
  const h2 = [
    "Director's vision", "Story bible",
    "Act 0 — Breath (Loading screen)", "Act 1 — The Fall (Home page)",
    "Act 2 — The Quiet Room (About page)", "Act 3 — The Battlefield (Skills page)",
    "Act 4 — The Upper Ranks (Projects page)", "Act 5 — The Demon King (Experience page)",
    "Act 6 — Dawn (transition)", "Act 7 — The Mansion (Contact page)", "Production notes",
  ];
  const h3 = [
    "Sound motifs", "Color script", "The swordsman and Ink Breathing", "Camera words used in this script",
    "Opening shots", "The Pillar template (repeat for each skill group, 6–8 seconds each)",
    "Pillar to skill mapping", "Closing shots",
    "The Upper Rank template (repeat per project, 10–12 seconds each)", "Demon ideas for typical projects",
    "The phase template (repeat per experience entry)",
    "Real 3D, Blender first", "How each shot becomes code", "Safety nets for real visitors",
    "Keeping it original", "Build order",
  ];

  it("PDF transcription sanity: 42 shot headings", () => {
    expect(screenplayShots).toHaveLength(42);
  });

  it.each(h2)("has H2 %s", (text) => {
    expect(levelOf(list, text), `"${text}" should be an H2`).toContain(2);
  });

  it.each(h3)("has H3 %s", (text) => {
    expect(levelOf(list, text), `"${text}" should be an H3`).toContain(3);
  });

  it.each(screenplayShots)("has H3 %s", (text) => {
    expect(levelOf(list, text), `"${text}" should be an H3`).toContain(3);
  });

  it("covers Shots 4.A to 4.F", () => {
    for (const letter of ["A", "B", "C", "D", "E", "F"]) {
      expect(list.some((h) => h.level === 3 && h.text.startsWith(`Shot 4.${letter} — `))).toBe(true);
    }
  });
});

describe("docs originals and notes", () => {
  const pdfs = [
    "docs/Midnight to Dawn — Director's Implementation Plan.pdf",
    "docs/Midnight to Dawn — Technical Design Document.pdf",
    "docs/Midnight to Dawn — Demon Slayer Portfolio Screenplay.pdf",
  ];

  it.each(pdfs)("keeps the original PDF %s", (pdf) => {
    expect(existsSync(new URL(pdf, root))).toBe(true);
    expect(statSync(new URL(pdf, root)).size).toBeGreaterThan(0);
  });

  it.each(["docs/plan.md", "docs/tdd.md", "docs/screenplay.md"])(
    "%s has a byline and a 'Converted from' note after the H1",
    (file) => {
      const top = read(file).split("\n").slice(0, 12).join("\n");
      expect(top).toMatch(/Converted from/);
    },
  );

  it.each(["docs/plan.md", "docs/tdd.md", "docs/screenplay.md"])(
    "%s has Conversion notes as its last H2",
    (file) => {
      const h2s = headings(read(file)).filter((h) => h.level === 2);
      expect(h2s[h2s.length - 1]?.text).toBe("Conversion notes");
    },
  );
});

describe("docs/progress.md layout", () => {
  const progress = read("docs/progress.md");
  const h2s = headings(progress).filter((h) => h.level === 2).map((h) => h.text);
  const section = (name: string, next: string): string =>
    progress.split(`## ${name}`)[1]?.split(`## ${next}`)[0] ?? "";

  it("has exactly Done, Next, Open issues as H2 sections, in that order", () => {
    expect(h2s).toEqual(["Done", "Next", "Open issues"]);
  });

  it("names F.1/W.04 as the next item", () => {
    expect(section("Next", "Open issues")).toContain("F.1/W.04");
  });

  it("groups Open issues into subsections including the F.1/W.03 conversion decisions", () => {
    const open = progress.split("## Open issues")[1] ?? "";
    const subs = open.split("\n").filter((l) => l.startsWith("### "));
    expect(subs.length).toBeGreaterThanOrEqual(3);
    expect(subs.some((s) => s.includes("F.1/W.03"))).toBe(true);
    expect(subs.some((s) => s.includes("F.1/W.05"))).toBe(true);
  });
});
