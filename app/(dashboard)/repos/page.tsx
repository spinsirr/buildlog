import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function ReposPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: repos } = await supabase
    .from('connected_repos')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Repos</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect GitHub repos to auto-generate posts from your activity.</p>
        </div>
        <Button>Connect repo</Button>
      </div>

      {repos?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-muted-foreground text-sm">No repos connected yet.</p>
            <Button variant="outline">Connect your first repo</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {repos?.map(repo => (
            <Card key={repo.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">{repo.full_name}</CardTitle>
                  <Badge variant={repo.is_active ? 'default' : 'secondary'}>
                    {repo.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardDescription>
                  Connected {new Date(repo.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
