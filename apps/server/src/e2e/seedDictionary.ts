import type pg from "pg"

/// A few WordNet style meanings and frequency ranks, enough for the word
/// popup to choose between meanings the way it does with the full
/// dictionary. The real dictionary is loaded by the ingest scripts and is far
/// too large to load for every test run.
const SENSES: { lemma: string; pos: string; rank: number; definition: string; examples: string[] }[] = [
  {
    lemma: "bank",
    pos: "n",
    rank: 1,
    definition: "sloping land (especially the slope beside a body of water)",
    examples: ["they pulled the canoe up on the bank"],
  },
  {
    lemma: "bank",
    pos: "n",
    rank: 2,
    definition: "a financial institution that accepts deposits and channels the money into lending activities",
    examples: ["he cashed a check at the bank"],
  },
  {
    lemma: "bank",
    pos: "v",
    rank: 1,
    definition: "tip laterally",
    examples: ["the pilot had to bank the aircraft"],
  },
  {
    lemma: "river",
    pos: "n",
    rank: 1,
    definition: "a large natural stream of water (larger than a creek)",
    examples: ["the river was navigable for 50 miles"],
  },
]

const RANKS: Record<string, number> = {
  bank: 1500,
  river: 2500,
  money: 300,
  deposit: 5000,
  water: 600,
  loan: 4200,
}

export async function seedDictionary(pool: pg.Pool): Promise<void> {
  for (const sense of SENSES) {
    await pool.query(
      `INSERT INTO dictionary_senses (lemma, pos, sense_rank, definition, examples) VALUES ($1, $2, $3, $4, $5)`,
      [sense.lemma, sense.pos, sense.rank, sense.definition, sense.examples]
    )
  }
  for (const [word, rank] of Object.entries(RANKS)) {
    await pool.query(`INSERT INTO word_frequency (word, rank, count) VALUES ($1, $2, $3)`, [
      word,
      rank,
      Math.round(10_000_000 / rank),
    ])
  }
}