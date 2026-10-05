import 'dotenv/config'
import fs from "fs"
import path from 'path'
import wordnetDb from 'wordnet-db'
import {pool} from '../db/index.js'

interface Gloss{
    definition: string
    examples: string[]
}

interface Sense{
    lemma: string
    pos: string
    senseRank: number
    definition: string
    examples: string[]
}

const POS_FILES = [
    { pos: 'n', name: 'noun' },
    { pos: 'v', name: 'verb' },
    { pos: 'a', name: 'adj' },
    { pos: 'r', name: 'adv' },
]

const BATCH_SIZE = 1000

///wordnet files start with a license block where every line begins with two spaces
function isSkippable(line:string): boolean{
    if(line.trim().length === 0){
        return true
    }
    if (line.startsWith('  ')){
        return true
    }
    return false
}

// data.* line format: offset lex_filenum ss_type w_cnt word ... | gloss
// The gloss holds the definition, then optional quoted examples separated by ; "
function parseDataFile(filePath: string): Map<string, Gloss>{
    const glosses = new Map<string, Gloss>()
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n')

    for(const line of lines){
        if(isSkippable(line)){
            continue
        }

        const offset = line.split(' ')[0]
        const barIndex = line.indexOf(' | ')
        if (!offset || barIndex === -1){
            continue
        }

        const gloss = line.slice(barIndex + 3).trim()
        const parts = gloss.split(/;\s*"/)
        const definition = (parts[0] ?? '').trim()

        const examples: string[] = []
        for(let i = 1; i < parts.length; i++){
            const cleaned = (parts[i] ?? '').replace(/"/g, '').trim()
            if(cleaned.length > 0){
                examples.push(cleaned)
            }
        }

        glosses.set(offset, {definition, examples})
    }
    return glosses
}

// index.* line format:
// lemma pos synset_cnt p_cnt [ptr_symbol x p_cnt] sense_cnt tagsense_cnt [synset_offset x synset_cnt]
// Offsets are listed in frequency order, so their position is the sense rank.
function parseIndexFile(filePath: string, pos: string, glosses: Map<string, Gloss>): Sense[]{
    const senses: Sense[] = []
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n')

    for(const line of lines){
        if(isSkippable(line)){
            continue
        }

        const parts = line.trim().split(/\s+/)
        const rawLemma = parts[0]
        if(!rawLemma){
            continue
        }
        const lemma = rawLemma.replace(/_/g, ' ')
        const synsetCount = parseInt(parts[2] ?? '0', 10)
        const pointerCount = parseInt(parts[3] ?? '0', 10)
        const offsetsStart = 4 + pointerCount + 2
        const offsets = parts.slice(offsetsStart, offsetsStart + synsetCount)

        for (let i = 0; i < offsets.length; i++) {
        const offset = offsets[i]
        if (!offset) {
            continue
        }
        const gloss = glosses.get(offset)
        if (!gloss) {
            continue
        }
        senses.push({
            lemma,
            pos,
            senseRank: i + 1,
            definition: gloss.definition,
            examples: gloss.examples,
        })
        }
    }

    return senses
}

async function insertBatch(rows: Sense[]): Promise<void>{
    const values: unknown[] = []
    const placeholders: string[] = []

    for(let i = 0; i < rows.length; i++){
        const row = rows[i]
        if(!row){
            continue
        }
        const base = i * 5
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`)
        values.push(row.lemma, row.pos, row.senseRank, row.definition, row.examples)
    }

    await pool.query(
    `INSERT INTO dictionary_senses (lemma, pos, sense_rank, definition, examples)
     VALUES ${placeholders.join(', ')}`,
    values
  )
}

async function main(): Promise<void>{
    console.log(`[wordnet] reading WordNet ${wordnetDb.version} from ${wordnetDb.path}`)

    await pool.query('TRUNCATE dictionary_senses RESTART IDENTITY')

    let total = 0
    for(const file of POS_FILES){
        const glosses = parseDataFile(path.join(wordnetDb.path, `data.${file.name}`))
        const senses = parseIndexFile(path.join(wordnetDb.path, `index.${file.name}`), file.pos, glosses)
        
        for(let i = 0; i < senses.length; i+= BATCH_SIZE){
            await insertBatch(senses.slice(i, i + BATCH_SIZE))
        }

        console.log(`[wordnet] ${file.name}: ${senses.length} senses`)
        total += senses.length
    }

    console.log(`[wordnet] done, ${total} senses inserted`)
    await pool.end()
}

main().catch(async (err) => {
  console.error(err)
  await pool.end()
  process.exit(1)
})