-- Paid transcription usage, so the server can cap spending per day.
-- paid_seconds stays empty for free feed transcripts.
ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS paid_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS transcripts_paid_completed_at_idx
  ON transcripts (completed_at)
  WHERE paid_seconds IS NOT NULL;