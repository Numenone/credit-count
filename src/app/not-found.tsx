import Link from "next/link";
import { CoasterMark } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="rise mx-auto max-w-md py-16 text-center">
      <span className="inline-block" style={{ color: "var(--brand)" }}>
        <CoasterMark size={34} />
      </span>
      <h1 className="display mt-4 text-3xl font-semibold">No track this way</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">
        That page does not exist. The leaderboard and your dashboard are both still where you left
        them.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link href="/dashboard" className="btn btn-primary">
          Go to dashboard
        </Link>
        <Link href="/leaderboard" className="btn btn-quiet">
          View leaderboard
        </Link>
      </div>
    </div>
  );
}
