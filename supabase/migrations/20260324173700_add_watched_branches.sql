-- Add watched_branches to connected_repos
-- NULL or empty array means all branches are watched
alter table connected_repos
  add column watched_branches text[] default null;
