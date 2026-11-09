import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Midnight to Dawn",
  description: "Akhilesh Singh's portfolio: one night told as a single camera journey.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
