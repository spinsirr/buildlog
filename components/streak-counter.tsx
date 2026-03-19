"use client";

import useSWR from "swr";
import { Flame } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function StreakCounter() {
  const { data } = useSWR<{ stats: { label: string; value: number }[] }>(
    "/api/dashboard",
    fetcher,
    { dedupingInterval: 60000 }
  );

  const streak = data?.stats?.find((s) => s.label === "Streak Days")?.value ?? 0;

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-zinc-900 border border-zinc-800">
        <Flame className="h-4 w-4 text-orange-400" />
        <span className="text-sm font-medium text-zinc-300">{streak}</span>
        <span className="text-xs text-zinc-500">day streak</span>
      </div>
    </div>
  );
}
