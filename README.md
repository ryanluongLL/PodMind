# PodMind

Most language apps teach you with fake dialogues. PodMind teaches you from how people actually speak — comedians, journalists, scientists, storytellers. Listen to real podcasts, click any word to translate it, save it to your vocabulary deck, and review it forever with spaced repetition.

🔗 Live Demo: [pod-mind-web.vercel.app](https://pod-mind-web.vercel.app)

## What it does

- Add any English podcast via RSS feed or iTunes search
- Transcribe episodes with OpenAI Whisper — word-level timestamps for synchronized playback
- Click any word in the transcript to instantly translate it to your native language (powered by DeepL + Claude)
- Save words to your vocabulary deck with full sentence context
- Review saved words with SM-2 spaced repetition flashcards (same algorithm as Anki)
- Claude rates each episode A1-C2 (CEFR scale) based on vocabulary complexity and speaking speed
- Semantic search across all transcripts using pgvector embeddings
- Learning dashboard with streak tracking, words saved this week, and review count
- Supports 10 native languages for translation

## Tech Stack

**Frontend:** Next.js 15, TypeScript, TanStack Query, CSS Modules, Sonner  
**Backend:** Node.js, Express, TypeScript, BullMQ, Redis  
**Database:** PostgreSQL + pgvector (HNSW index for semantic search)  
**AI:** OpenAI Whisper (transcription + embeddings), Claude API (translation breakdown, difficulty rating), DeepL API (translation)  
**Auth:** Clerk  
**Deployed on:** Vercel (frontend) + Railway (backend + PostgreSQL + Redis)  
**CI/CD:** GitHub Actions — TypeScript type check + path-based deploys (server only on backend changes, web only on frontend changes)

## Running it locally

**Prerequisites:** Docker Desktop, Node.js 22+

**1. Start the databases**
```bash
docker compose up -d
```

**2. Backend**
```bash
cd apps/server
npm install
npm run dev
```

Create `apps/server/.env`:
```env
DATABASE_URL=postgresql://podmind:podmind@localhost:5432/podmind
REDIS_URL=redis://localhost:6379
PORT=3001
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
DEEPL_API_KEY=your_key
CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_key
FRONTEND_URL=http://localhost:3000
```

**3. Frontend**
```bash
cd apps/web
npm install
npm run dev
```

Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

## About

Built by Luan Luong

- GitHub: [@ryanluongLL](https://github.com/ryanluongLL)
- Email: [luongryanll@gmail.com](mailto:luongryanll@gmail.com)