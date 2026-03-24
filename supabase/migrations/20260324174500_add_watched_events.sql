-- Add watched_events to connected_repos
-- NULL or empty array means all event types are watched
-- Valid values: 'push', 'pull_request', 'release'
alter table connected_repos
  add column watched_events text[] default null;
