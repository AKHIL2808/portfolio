// Dev-only smoke page for the scroll system (F.3/W.03). 404 in production.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ScrollSmoke from "./ScrollSmoke";

export const metadata: Metadata = { title: "Scroll smoke (dev)", robots: { index: false } };

export default function DevScrollPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ScrollSmoke />;
}
