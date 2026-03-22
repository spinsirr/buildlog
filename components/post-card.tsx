import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface Post {
  id: string
  content: string
  status: string
  source_type: string
  created_at: string
  published_at?: string | null
}

interface PostCardProps {
  post: Post
  showActions?: boolean
}

export function PostCard({ post, showActions = true }: PostCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{post.source_type}</Badge>
            <Badge variant={post.status === 'published' ? 'default' : 'outline'}>
              {post.status}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(post.created_at).toLocaleDateString()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed">{post.content}</p>
        {showActions && post.status === 'draft' && (
          <>
            <Separator />
            <div className="flex gap-2">
              <Button size="sm">Publish</Button>
              <Button size="sm" variant="outline">
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive ml-auto"
              >
                Archive
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
