import type { Metadata } from "next";
import { TopNav } from "@/components/top-nav";
import { WorkbenchProvider } from "@/lib/workbench-context";
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
      <body>
        <WorkbenchProvider>
          <main className="app-shell">
            <TopNav />
            {children}
          </main>
        </WorkbenchProvider>
      </body>
    </html>
  );
}
