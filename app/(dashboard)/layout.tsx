import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-lg">buildlog</Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/repos" className="hover:text-foreground transition-colors">Repos</Link>
              <Link href="/posts" className="hover:text-foreground transition-colors">Posts</Link>
            </nav>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.github_avatar_url ?? undefined} />
            <AvatarFallback>{profile?.github_username?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
          </Avatar>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
