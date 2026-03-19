"use client";

import useSWR from "swr";
import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, mutate } = useSWR<{
    notifications: Notification[];
    unreadCount: number;
  }>("/api/notifications", fetcher, {
    refreshInterval: 30000, // Poll every 30s
  });

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    mutate();
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-indigo-500" />
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-72 z-50 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
              <span className="text-xs font-medium text-zinc-300">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1.5 text-indigo-400">({unreadCount})</span>
                )}
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-zinc-600">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.link) window.location.href = n.link;
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors",
                      !n.read && "bg-indigo-500/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                      )}
                      <div className={cn("flex-1", n.read && "ml-3.5")}>
                        <p className="text-xs text-zinc-300 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
