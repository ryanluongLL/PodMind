-- Episodes used to be told apart by their <link>. Many feeds give every
-- episode the same link (the show's homepage), so all of a show's episodes
-- collapsed into one row. RSS gives each episode a <guid> for exactly this,
-- so episodes are now unique by podcast and guid.
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS guid TEXT;

ALTER TABLE episodes DROP CONSTRAINT IF EXISTS episodes_episode_url_user_unique;

-- Rows saved before this migration keep a NULL guid until their feed is
-- refreshed. Postgres treats NULLs as distinct, so they never conflict.
CREATE UNIQUE INDEX IF NOT EXISTS episodes_podcast_guid_unique ON episodes (podcast_id, guid);