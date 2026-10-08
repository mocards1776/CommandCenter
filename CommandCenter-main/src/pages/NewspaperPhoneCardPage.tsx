import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PhoneDayAheadCard } from "@/components/newspaper/PhoneDayAheadCard";
import { PhoneFrontCard } from "@/components/newspaper/PhoneFrontCard";
import { PhoneWatchCard } from "@/components/newspaper/PhoneWatchCard";
import { PhoneWeatherCard } from "@/components/newspaper/PhoneWeatherCard";
import { fetchDaySchedule } from "@/lib/newspaper-day-ahead-fetch";
import { readRemoteQueries, readRemoteStories } from "@/lib/newspaper-issue-remote";
import { queryNamed } from "@/lib/newspaper-document";
import { applyStoryDeks, applyWatchWhy, asTimesCopy } from "@/lib/newspaper-copy-desk";
import type { GameWrapCard } from "@/lib/newspaper-sports";
import {
  isPhoneCardKind,
  phoneCardDate,
  phoneCardEditionLabel,
  phoneFrontStories,
  sampleDaySchedule,
  sampleFrontStories,
  sampleHeavyWatchGames,
  sampleWatchGames,
  type PhoneCardKind,
} from "@/lib/newspaper-phone-cards";
import { fetchMarshfieldWeather } from "@/lib/newspaper-weather";
import { fetchWatchList } from "@/lib/newspaper-watch";

/**
 * Dedicated render route for the Times Telegram screenshot runner.
 * The printed paper never links here. Same data as the paper pages; phone layout only.
 *
 *   /newspaper/phone-card?card=front|weather|day|watch&issue=2026-10-05-evening&solo=1
 *   &sample=1  — verification fixtures (not used by the production runner)
 *   &sample=heavy — a full watch slate, to prove games drop instead of growing
 */
export default function NewspaperPhoneCardPage() {
  const [params] = useSearchParams();
  const card = isPhoneCardKind(params.get("card")) ? (params.get("card") as PhoneCardKind) : "weather";
  const issue = params.get("issue");
  const sample = params.get("sample");
  const useSample = sample === "1" || sample === "heavy";
  const date = phoneCardDate(issue);
  const editionLabel = phoneCardEditionLabel(issue);

  const frontQ = useQuery({
    queryKey: ["tt-phone-front", issue, useSample],
    queryFn: async () => {
      if (useSample) return sampleFrontStories();
      if (!issue) return [];
      try {
        const [stories, queries] = await Promise.all([
          readRemoteStories(issue),
          readRemoteQueries(issue).catch(() => null),
        ]);
        if (!stories) return [];
        const stamped = applyStoryDeks(stories as GameWrapCard[], asTimesCopy(queryNamed(queries ?? [], "tt-copy")));
        return phoneFrontStories(stamped, issue);
      } catch {
        return [];
      }
    },
    enabled: card === "front",
    staleTime: 5 * 60_000,
    retry: false,
  });

  const weatherQ = useQuery({
    queryKey: ["tt-phone-weather"],
    queryFn: fetchMarshfieldWeather,
    enabled: card === "weather",
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const dayQ = useQuery({
    queryKey: ["tt-phone-day", date, useSample],
    queryFn: async () => {
      if (useSample) return sampleDaySchedule(date);
      try {
        // Same fetch as DailyNewspaperPage: one row per America/Chicago date.
        return await fetchDaySchedule(date);
      } catch {
        // No readable row (RLS, missing date) — skip the photo.
        return null;
      }
    },
    enabled: card === "day",
    staleTime: 5 * 60_000,
    retry: false,
  });

  const watchQ = useQuery({
    queryKey: ["tt-phone-watch", date, sample],
    queryFn: async () => {
      if (sample === "heavy") return sampleHeavyWatchGames(date);
      if (sample === "1") return sampleWatchGames();
      const live = await fetchWatchList(date);
      if (!issue) return live;
      try {
        const queries = await readRemoteQueries(issue);
        return applyWatchWhy(live, asTimesCopy(queryNamed(queries ?? [], "tt-copy")));
      } catch {
        return live;
      }
    },
    enabled: card === "watch",
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const ready =
    card === "front"
      ? frontQ.data?.length
        ? "1"
        : frontQ.isFetched
          ? "empty"
          : "loading"
      : card === "weather"
        ? weatherQ.isError
          ? "error"
          : weatherQ.data?.days.length
            ? "1"
            : weatherQ.isFetched
              ? "empty"
              : "loading"
        : card === "day"
          ? dayQ.isError
            ? "error"
            : dayQ.data
              ? "1"
              : dayQ.isFetched
                ? "empty"
                : "loading"
          : watchQ.isError
            ? "error"
            : watchQ.data?.length
              ? "1"
              : watchQ.isFetched
                ? "empty"
                : "loading";

  return (
    <div className="tt-phone-page" data-phone-card={card} data-ready={ready}>
      {card === "front" && frontQ.data?.length ? (
        <PhoneFrontCard date={date} editionLabel={editionLabel} stories={frontQ.data} />
      ) : null}
      {card === "weather" && weatherQ.data?.days.length ? <PhoneWeatherCard weather={weatherQ.data} /> : null}
      {card === "day" && dayQ.data ? (
        <PhoneDayAheadCard
          date={dayQ.data.date}
          events={dayQ.data.events}
          upcoming={dayQ.data.upcoming}
          editionLabel={editionLabel}
        />
      ) : null}
      {card === "watch" && watchQ.data?.length ? (
        <PhoneWatchCard games={watchQ.data} editionLabel={editionLabel} />
      ) : null}
    </div>
  );
}
