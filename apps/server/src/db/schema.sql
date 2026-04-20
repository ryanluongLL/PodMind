CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE podcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    podbean_url TEXT UNIQUE,
    rss_url TEXT UNIQUE,
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- space
CREATE TABLE episodes(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    podcast_id UUID REFERENCES podcasts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    episode_url TEXT UNIQUE NOT NULL,
    icon_url TEXT,
    published_at TIMESTAMPTZ,
    is_favorite BOOLEAN DEFAULT FALSE,
    rating INT CHECK (
        rating BETWEEN 1 AND 5
    ),
    hashtags TEXT [] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE transcripts(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE UNIQUE,
    full_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(
        status IN ('pending', 'processing', 'done', 'failed')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE embeddings(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding vector(1536),
    chunk_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);