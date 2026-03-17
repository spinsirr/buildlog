import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: repos }, { data: posts }] = await Promise.all([
    supabase.from('connected_repos').select('*').eq('user_id', user!.id),
    supabase.from('posts').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/repos" className={cn(buttonVariants())}>Connect repo</Link>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Connected repos</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold">{repos?.length ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Draft posts</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold">{posts?.filter(p => p.status === 'draft').length ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Published</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold">{posts?.filter(p => p.status === 'published').length ?? 0}</p></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent posts</CardTitle>
          <CardDescription>Your latest generated drafts</CardDescription>
        </CardHeader>
        <CardContent>
          {posts?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet. Connect a repo to get started.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {posts?.map(post => (
                <div key={post.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border">
                  <p className="text-sm line-clamp-2">{post.content}</p>
                  <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>{post.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
