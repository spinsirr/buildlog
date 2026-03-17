import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Repo {
  id: string
  full_name: string
  is_active: boolean
  created_at: string
  webhook_id?: number | null
}

interface RepoCardProps {
  repo: Repo
}

export function RepoCard({ repo }: RepoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-mono">{repo.full_name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={repo.is_active ? 'default' : 'secondary'}>
              {repo.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {repo.webhook_id && (
              <Badge variant="outline" className="text-xs">Webhook</Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Connected {new Date(repo.created_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <a
            href={`https://github.com/${repo.full_name}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
          >
            View on GitHub
          </a>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto">
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
