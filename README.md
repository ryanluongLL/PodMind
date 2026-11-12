# PodMind

![CI](https://github.com/ryanluongLL/PodMind/actions/workflows/ci.yml/badge.svg)

Learn English from real podcasts. PodMind transcribes episodes with timestamps, lets you click any word to see what it means **in that sentence**, saves it with its context, and schedules reviews with spaced repetition.

**Live demo:** [pod-mind-web.vercel.app](https://pod-mind-web.vercel.app)

## Features

* **Build a library** by searching iTunes, pasting an RSS feed, or browsing topics on the Discover page, which scores each show for learners (episode length, release schedule, whether it is made for learners)
* **Transcripts that follow the audio.** Each line highlights as it is spoken, and clicking a line jumps the player there
* **Word lookup that understands context.** "bank" in *deposit money at the bank* and "bank" in *the bank of the river* get different meanings and translations
* **Real example sentences** pulled from other episodes in the library, each one playable at the moment it was spoken
* **Spaced repetition review** with SM-2 (the algorithm behind Anki), streaks, and a daily listening goal
* **CEFR difficulty (A1 to C2)** for every transcribed episode, from readability and speaking speed
* **Semantic search** across every transcript with pgvector
* **No account needed.** The podcast library is shared, and personal progress stays in the browser

## Architecture

![PodMind architecture: the browser talks to an Express API backed by PostgreSQL and a Redis job queue; a worker transcribes audio with Whisper; DeepL and iTunes are outside services](docs/architecture_excalidraw.png)

Transcribing is slow, so it runs as a background job. The API puts the episode on a Redis queue (BullMQ). The worker downloads the audio, compresses it to 16 kbps with ffmpeg, sends it to Whisper for timestamped segments, and stores 500 word chunks with embeddings for search. A unique constraint on the transcript row means two people clicking Transcribe at the same moment still start only one job.

## How word lookup works

Clicking a word does not call a language model. The meaning is chosen by classic NLP running on the server, and DeepL is used only for the final translation, cached per meaning.

![How word lookup works: the browser sends the word and its sentence to the API; the API tags the sentence, loads WordNet meanings and word frequencies from PostgreSQL, picks the meaning with weighted Lesk, checks the translation cache and calls DeepL only on a miss, finds example sentences in transcripts, and returns the meaning, translation, rarity, and examples](docs/sequence_diagram.png)

1. **Tagging.** wink-nlp tags the whole sentence, so "run" in *a morning run* is a noun and "run" in *I run every day* is a verb.
2. **Choosing the meaning.** A weighted version of the Lesk algorithm compares the sentence with each WordNet definition. Shared words count more when they are rare (weighted by their rank in a 50,000 word frequency list), plus a bonus for the right part of speech and a small preference for common meanings.
3. **Translating.** DeepL gets the word with the sentence as context. The result is cached under the word *and* the chosen meaning, so each meaning is translated once and then served from Postgres.
4. **Rarity and examples.** The frequency rank becomes a "very common" to "rare" label, and example sentences are found in finished transcripts by matching every inflected form ("bank", "banks", "banked").

Episode difficulty works the same way, without a model: the Flesch reading ease score of the transcript maps to a CEFR band, then speaking speed moves it one band easier (under 110 words per minute) or harder (over 165).

## Testing and CI

Every pull request runs four required checks on GitHub Actions. Nothing merges into `main` unless all of them pass.

| Check | What it covers |
|---|---|
| **Lint, types, unit tests, build** | ESLint, strict TypeScript for both apps, 125 unit tests (91 server, 34 web) with coverage limits, and production builds |
| **Integration tests** | 50 tests that send real HTTP requests to the Express routes, backed by a fresh PostgreSQL 16 + pgvector database. DeepL, OpenAI, and Redis are replaced with fakes |
| **End to end tests** | 11 Playwright tests in Chromium against a production build and the real API: onboarding, adding a podcast, word lookup, saving, review, and persistence. All internet access is blocked, and DeepL and the RSS feed are local fakes |
| **Performance budgets** | API speed limits under load on a 200 podcast library, JavaScript size limits per page, and Lighthouse scores (performance and best practices at least 0.9, accessibility 1.0) |

The tests have caught real bugs: audio seeking that hung on suffix byte ranges, malformed IDs returning 500 instead of 404, an API that could not start without Redis, text that failed WCAG contrast, and a library list that would not show an N+1 query slowdown until the load test was given realistic data.

## Tech stack

| Area | Tools |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, TanStack Query, CSS Modules |
| Backend | Node.js 24, Express 5, TypeScript, BullMQ, ffmpeg |
| Data | PostgreSQL 16, pgvector (HNSW index), Redis |
| Language | wink-nlp, WordNet 3.1, OpenSubtitles frequency list, DeepL |
| Speech and search | OpenAI Whisper, OpenAI embeddings |
| Testing | Vitest, Supertest, Playwright, autocannon, Lighthouse CI |
| CI | GitHub Actions with a branch ruleset on `main` |

## Project structure

```
apps/
  server/                 Express API and transcription worker
    src/routes/           HTTP routes
    src/nlp/              Tagging, Lesk, example ranking, inflections
    src/jobs/             BullMQ queue and Whisper worker
    src/db/migrations/    SQL schema
    src/scripts/          WordNet and frequency list import
    src/integration/      Integration tests
    src/e2e/              Test server and fake outside services
    src/perf/             API load test and budgets
  web/                    Next.js app
    app/                  Pages and components
    lib/                  API client, local storage store, player
    e2e/                  Playwright tests
    scripts/              JavaScript size check
.github/workflows/ci.yml  CI pipeline
docker-compose.yml        PostgreSQL + pgvector and Redis for local development
```

## Running locally

**You need:** Node.js 24 and Docker Desktop.

**1. Install and start the databases**

```bash
npm install
docker compose up -d
```

**2. Create the schema**

```bash
docker compose exec -T postgres psql -U podmind -d podmind < apps/server/src/db/migrations/001_schema.sql
docker compose exec -T postgres psql -U podmind -d podmind < apps/server/src/db/migrations/002_dictionary.sql
```

**3. Add environment files**

`apps/server/.env`

```env
DATABASE_URL=postgresql://podmind:podmind@localhost:5432/podmind
REDIS_URL=redis://localhost:6379
PORT=3001
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=your_key
DEEPL_API_KEY=your_key
```

`apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**4. Load the dictionary** (once, takes a few minutes)

```bash
cd apps/server
npx tsx src/scripts/ingest-wordnet.ts
npx tsx src/scripts/ingest-frequency.ts
cd ../..
```

**5. Start the app** in two terminals

```bash
npm run dev --workspace server
```

```bash
npm run dev --workspace web
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

Run from the repo root.

| Command | What it does |
|---|---|
| `npm run check` | Lint, typecheck, unit tests with coverage, and both builds |
| `npm run test:integration` | Integration tests (needs Docker running) |
| `npm run test:e2e` | Playwright end to end tests (needs Docker running) |
| `npm run perf:api` | API load test against its budgets |
| `npm run perf:bundle` | JavaScript size per page, after a build |
| `npm run perf:lighthouse` | Lighthouse scores for the main pages |

## About

Built by Luan Luong

* GitHub: [@ryanluongLL](https://github.com/ryanluongLL)
* LinkedIn: [Luan Luong](https://www.linkedin.com/in/luan-luong-132776314/)
* Email: [luanluongforwork@gmail.com](mailto:luanluongforwork@gmail.com)