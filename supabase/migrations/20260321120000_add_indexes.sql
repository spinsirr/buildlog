-- Performance indexes for common query patterns

-- Posts: filter by user + status (dashboard, post lists)
CREATE INDEX IF NOT EXISTS idx_posts_user_status ON posts (user_id, status);

-- Posts: filter by user + source type (usage breakdown)
CREATE INDEX IF NOT EXISTS idx_posts_user_source_type ON posts (user_id, source_type);

-- Posts: user's posts ordered by recency (dashboard, post lists)
CREATE INDEX IF NOT EXISTS idx_posts_user_created_desc ON posts (user_id, created_at DESC);

-- Notifications: unread notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications (user_id, read, created_at DESC);

-- Platform connections: lookup by user + platform
CREATE INDEX IF NOT EXISTS idx_platform_connections_user_platform ON platform_connections (user_id, platform);
