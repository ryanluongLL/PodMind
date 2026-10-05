import 'dotenv/config'
import { pool } from '../db/index.js'

const SOURCE_URL =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt'

const BATCH_SIZE = 2000

interface FrequencyRow {
  word: string
  rank: number
  count: number
}

async function insertBatch(rows: FrequencyRow[]): Promise<void> {
  const values: unknown[] = []
  const placeholders: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) {
      continue
    }
    const base = i * 3
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`)
    values.push(row.word, row.rank, row.count)
  }

  await pool.query(
    `INSERT INTO word_frequency (word, rank, count)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (word) DO NOTHING`,
    values
  )
}

async function main(): Promise<void> {
  console.log('[frequency] downloading word list')
  const response = await fetch(SOURCE_URL)
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`)
  }
  const text = await response.text()

  const rows: FrequencyRow[] = []
  const lines = text.split('\n')
  for (const line of lines) {
    const [word, countText] = line.trim().split(' ')
    if (!word || !countText) {
      continue
    }
    // Keep plain words only, skip numbers and symbols
    if (!/^[a-z']+$/.test(word)) {
      continue
    }
    rows.push({ word, rank: rows.length + 1, count: parseInt(countText, 10) })
  }

  await pool.query('TRUNCATE word_frequency')

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await insertBatch(rows.slice(i, i + BATCH_SIZE))
  }

  console.log(`[frequency] done, ${rows.length} words inserted`)
  await pool.end()
}

main().catch(async (err) => {
  console.error(err)
  await pool.end()
  process.exit(1)
})