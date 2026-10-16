"use client";

import dynamic from "next/dynamic";

const CinematicScrollExperience = dynamic(
  () =>
    import("@/components/home/CinematicScrollExperience").then(
      (m) => m.CinematicScrollExperience,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#04060c] text-cyan-300 font-mono text-sm tracking-widest">
        INITIALIZING SECTOR 07 3D WEBGL CHAMBER…
      </div>
    ),
  },
);

export default function HomePage() {
  return <CinematicScrollExperience />;
}
