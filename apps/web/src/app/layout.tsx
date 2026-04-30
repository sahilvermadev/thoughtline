import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThoughtLine",
  description:
    "Breed AI advisor agents into a personalized decision system with inherited reasoning and verifiable lineage on 0G",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
