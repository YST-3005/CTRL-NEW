import type { Metadata } from "next";
import { IBM_Plex_Sans, Syne } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "LabelLens Guardian",
  description: "Cinematic 3D AI food intelligence laboratory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${plex.variable} antialiased`}>
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-cyan-300 focus:p-2 focus:text-black">
          Skip to content
        </a>
        <AppShell>
          <div id="content" className="relative">
            {children}
          </div>
        </AppShell>
      </body>
    </html>
  );
}
