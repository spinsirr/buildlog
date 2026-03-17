import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default async function PostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: posts } = await supabase
    .from('posts')
    .select('*, connected_repos(full_name)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const drafts = posts?.filter(p => p.status === 'draft') ?? []
  const published = posts?.filter(p => p.status === 'published') ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-sm text-muted-foreground mt-1">Review AI-generated drafts and publish to your platforms.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Drafts ({drafts.length})
        </h2>
        {drafts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No drafts. Connect a repo to start generating posts.</p>
            </CardContent>
          </Card>
        ) : (
          drafts.map(post => (
            <Card key={post.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{post.source_type}</Badge>
                    {post.connected_repos && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {(post.connected_repos as { full_name: string }).full_name}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm">{post.content}</p>
                <Separator />
                <div className="flex gap-2">
                  <Button size="sm">Publish</Button>
                  <Button size="sm" variant="outline">Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">Archive</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {published.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Published ({published.length})
          </h2>
          {published.map(post => (
            <Card key={post.id} className="opacity-75">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="default">published</Badge>
                  <span className="text-xs text-muted-foreground">
                    {post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{post.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
