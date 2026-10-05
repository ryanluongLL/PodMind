CREATE TABLE IF NOT EXISTS dictionary_senses (
    id SERIAL PRIMARY KEY,
    lemma TEXT NOT NULL,
    pos CHAR(1) NOT NULL,
    sense_rank INT NOT NULL,
    definition TEXT NOT NULL,
    examples TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS dictionary_senses_lookup_idx
  ON dictionary_senses (lemma, pos, sense_rank);

CREATE TABLE IF NOT EXISTS word_frequency(
    word TEXT PRIMARY KEY,
    rank INT NOT NULL,
    count BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS translation_cache (
  word TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  translation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (word, target_lang)
);