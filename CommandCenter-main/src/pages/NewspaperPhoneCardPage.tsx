import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PhoneDayAheadCard } from "@/components/newspaper/PhoneDayAheadCard";
import { PhoneWatchCard } from "@/components/newspaper/PhoneWatchCard";
import { PhoneWeatherCard } from "@/components/newspaper/PhoneWeatherCard";
import { fetchDaySchedule } from "@/lib/newspaper-day-ahead-fetch";
import {
  isPhoneCardKind,
  phoneCardDate,
  phoneCardEditionLabel,
  sampleDaySchedule,
  sampleWatchGames,
  type PhoneCardKind,
} from "@/lib/newspaper-phone-cards";
import { fetchMarshfieldWeather } from "@/lib/newspaper-weather";
import { fetchWatchList } from "@/lib/newspaper-watch";

/**
 * Dedicated render route for the Times Telegram screenshot runner.
 * The printed paper never links here. Same data as the paper pages; phone layout only.
 *
 *   /newspaper/phone-card?card=weather|day|watch&issue=2026-10-05-evening&solo=1
 *   &sample=1  — verification fixtures (not used by the production runner)
 */
export default function NewspaperPhoneCardPage() {
  const [params] = useSearchParams();
  const card = isPhoneCardKind(params.get("card")) ? (params.get("card") as PhoneCardKind) : "weather";
  const issue = params.get("issue");
  const sample = params.get("sample") === "1";
  const date = phoneCardDate(issue);
  const editionLabel = phoneCardEditionLabel(issue);

  const weatherQ = useQuery({
    queryKey: ["tt-phone-weather"],
    queryFn: fetchMarshfieldWeather,
    enabled: card === "weather",
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const dayQ = useQuery({
    queryKey: ["tt-phone-day", date, sample],
    queryFn: async () => {
      if (sample) return sampleDaySchedule(date);
      try {
        return await fetchDaySchedule(date);
      } catch {
        // Table missing (Day Ahead PR not merged) or RLS — skip the photo.
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
      const live = await fetchWatchList(date);
      if (live.length) return live;
      return sample ? sampleWatchGames() : [];
    },
    enabled: card === "watch",
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const ready =
    card === "weather"
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
      {card === "weather" && weatherQ.data?.days.length ? <PhoneWeatherCard weather={weatherQ.data} /> : null}
      {card === "day" && dayQ.data ? <PhoneDayAheadCard schedule={dayQ.data} editionLabel={editionLabel} /> : null}
      {card === "watch" && watchQ.data?.length ? (
        <PhoneWatchCard games={watchQ.data} editionLabel={editionLabel} />
      ) : null}
    </div>
  );
}
