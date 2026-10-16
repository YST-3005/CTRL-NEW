import Link from "next/link";
import { Button } from "@/components/ui/Hud";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 text-center">
      <p className="hud-label text-cyan-400">404 — Module Not Found</p>
      <h1 className="display text-4xl text-slate-100">Chamber Coordinates Unmapped</h1>
      <p className="max-w-md text-sm text-slate-400">
        The requested food-intelligence or laboratory path does not exist in the current station navigation matrix.
      </p>
      <div className="pt-2">
        <Link href="/">
          <Button variant="primary">Return to Laboratory</Button>
        </Link>
      </div>
    </div>
  );
}
