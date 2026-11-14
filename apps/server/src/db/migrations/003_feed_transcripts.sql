-- Many podcasts publish a free, timed transcript in their feed
-- (the Podcasting 2.0 <podcast:transcript> tag). Saving its link lets the
-- worker use it instead of paying for transcription.
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS transcript_url TEXT,
  ADD COLUMN IF NOT EXISTS transcript_format TEXT
    CHECK (transcript_format IN ('vtt', 'srt', 'json'));