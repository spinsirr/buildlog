import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  FileText,
  GitFork,
  Settings,
  Flame,
  LogOut,
} from "lucide-react";
import { MobileSidebar } from "@/components/mobile-sidebar";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/repos", label: "Repos", icon: GitFork },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-zinc-950 md:flex">
      {/* Mobile header */}
      <MobileSidebar profile={profile} />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 border-r border-zinc-800/50 flex-col fixed inset-y-0 left-0 bg-zinc-950 z-30">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-zinc-800/50">
          <Link
            href="/dashboard"
            className="font-semibold text-lg tracking-tight text-zinc-50"
          >
            Build<span className="text-purple-400">Log</span>
</Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Streak counter */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-zinc-900 border border-zinc-800">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium text-zinc-300">0</span>
            <span className="text-xs text-zinc-500">day streak</span>
          </div>
        </div>

        <Separator className="bg-zinc-800/50" />

        {/* User */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={profile?.github_avatar_url ?? undefined} />
              <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                {profile?.github_username?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-zinc-400 truncate flex-1">
              {profile?.github_username ?? "User"}
            </span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-60">
        <main className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
