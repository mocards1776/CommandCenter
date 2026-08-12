import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ScrollStory from "@/components/stories/ScrollStory";
import { resolveStoryToken } from "@/lib/stories/share";
import { getStory } from "@/lib/stories/types";

/**
 * Public client presentation. Token in the URL is the credential —
 * no login, no app chrome.
 */
export default function PublicStoryPage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "missing" }
    | { status: "ready"; slug: string; label: string | null }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await resolveStoryToken(token);
      if (cancelled) return;
      if (!resolved || !getStory(resolved.slug)) {
        setState({ status: "missing" });
        return;
      }
      setState({ status: "ready", slug: resolved.slug, label: resolved.label });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f4ec] text-[#081228]">
        <span className="text-[11px] tracking-[0.22em] uppercase text-[#5c6578]">Loading</span>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f4ec] text-[#081228] px-6">
        <div className="text-center max-w-md">
          <p className="text-[11px] tracking-[0.22em] uppercase text-[#c45c26] font-semibold mb-3">
            Mark Turner Financial Research
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl mb-3">Link unavailable</h1>
          <p className="text-[#5c6578] text-sm leading-relaxed mb-6">
            This presentation link is missing or has been revoked.
          </p>
          <Link to="/login" className="text-sm underline underline-offset-4 text-[#0d1d3c]">
            Staff sign in
          </Link>
        </div>
      </div>
    );
  }

  const story = getStory(state.slug);
  if (!story) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f4ec] text-[#081228]">
        <p>Story not found.</p>
      </div>
    );
  }

  return <ScrollStory story={story} clientMode label={state.label} />;
}
