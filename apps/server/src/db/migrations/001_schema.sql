CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS podcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  podbean_url TEXT,
  rss_url TEXT,
  icon_url TEXT,
  user_id TEXT NOT NULL DEFAULT 'placeholder',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT podcasts_rss_url_user_unique UNIQUE (rss_url, user_id),
  CONSTRAINT podcasts_podbean_url_user_unique UNIQUE (podbean_url, user_id)
);

CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id UUID REFERENCES podcasts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  episode_url TEXT NOT NULL,
  icon_url TEXT,
  audio_url TEXT,
  published_at TIMESTAMPTZ,
  is_favorite BOOLEAN DEFAULT FALSE,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  hashtags TEXT[] DEFAULT '{}',
  user_id TEXT NOT NULL DEFAULT 'placeholder',
  difficulty TEXT,
  words_per_minute INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT episodes_episode_url_user_unique UNIQUE (episode_url, user_id)
);

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID UNIQUE REFERENCES episodes(id) ON DELETE CASCADE,
  full_text TEXT NOT NULL,
  segments JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  progress INT DEFAULT 0,
  user_id TEXT NOT NULL DEFAULT 'placeholder',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'placeholder',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embeddings_hnsw_idx
  ON embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  native_language TEXT NOT NULL DEFAULT 'vi',
  english_level TEXT NOT NULL DEFAULT 'B1',
  daily_goal_minutes INT DEFAULT 15,
  current_streak INT DEFAULT 0,
  last_active_date DATE,
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  context_sentence TEXT NOT NULL,
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  timestamp_seconds REAL,
  ease_factor REAL DEFAULT 2.5,
  interval_days INT DEFAULT 1,
  next_review_date DATE DEFAULT CURRENT_DATE,
  review_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, word)
);