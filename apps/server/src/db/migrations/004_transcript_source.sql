-- Where each transcript came from: the publisher's free feed transcript,
-- or a paid transcription provider. Counting these shows how much money
-- the feed transcripts save.
ALTER TABLE transcripts
    ADD COLUMN IF NOT EXISTS source TEXT
        CHECK (source IN ('feed', 'openai', 'groq'));