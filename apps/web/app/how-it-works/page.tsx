import Link from "next/link"
import { DifficultyBadge } from "@/app/components/DifficultyBadge"
import styles from "./page.module.css"

const STEPS = [
  {
    title: "Add a podcast",
    description:
      "Click Add podcast in your library and search for any English podcast, or browse by topic on the Discover page. Episodes come straight from the podcast's own feed.",
  },
  {
    title: "Transcribe an episode",
    description:
      "Click the document icon on an episode. PodMind transcribes it with timestamps for every line, which takes a minute or two. When it's done, the episode shows Transcript ready.",
  },
  {
    title: "Listen and look up words",
    description:
      "Open the transcript with the arrow next to the episode. As the audio plays, the current line is highlighted. Click any word to see its translation, its meaning in that sentence, how common it is, and other places it was said in your podcasts.",
  },
  {
    title: "Review what you saved",
    description:
      "Save words from the lookup card, then practice them on the Review page. Spaced repetition schedules each word just before you'd forget it, so reviews stay short.",
  },
]

const LEVELS = [
  { level: "A1", title: "Beginner", wpm: "under 100 wpm", desc: "Very simple words, short sentences, and slow speech." },
  { level: "A2", title: "Elementary", wpm: "100 to 120 wpm", desc: "Everyday topics like food, travel, and family, in simple connected sentences." },
  { level: "B1", title: "Intermediate", wpm: "120 to 140 wpm", desc: "Most everyday situations, with some idioms and phrasal verbs." },
  { level: "B2", title: "Upper intermediate", wpm: "140 to 160 wpm", desc: "Abstract topics at a natural pace, with humor and cultural references." },
  { level: "C1", title: "Advanced", wpm: "160 to 180 wpm", desc: "Fluent, nuanced speech with sophisticated vocabulary." },
  { level: "C2", title: "Proficient", wpm: "over 180 wpm", desc: "Fast, native speech with accents, slang, and subtle references." },
]

const TIPS = [
  {
    tip: "Start one level below your comfort zone",
    detail: "If you understand 90% or more, new words are much easier to pick up from context.",
  },
  {
    tip: "Review a little every day",
    detail: "Five minutes daily works better than one long session a week. That's what spaced repetition is built around.",
  },
  {
    tip: "Use the speed control",
    detail: "Slow difficult episodes to 0.75x. Once normal speed feels easy, try 1.25x.",
  },
  {
    tip: "Read the sentence, not just the word",
    detail: "Every saved word keeps the sentence you heard it in. Reading it during review is what makes the word stick.",
  },
]

export default function HowItWorksPage() {
  return (
    <main className={styles.main}>
      <div className={styles.heroBanner}>
        <div className={styles.topNav}>
          <Link href="/" className={styles.logo}>
            PodMind
          </Link>
          <Link href="/" className={styles.signInBtn}>
            Open library
          </Link>
        </div>

        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Learn English from
            <br />
            real podcasts
          </h1>
          <p className={styles.heroDesc}>
            Most language apps teach with scripted dialogues. PodMind teaches with how people
            actually talk. Listen along with the transcript, look up any word in context, and
            review what you saved.
          </p>
          <div className={styles.heroActions}>
            <Link href="/" className={styles.heroCta}>
              Start listening
            </Link>
            <a href="#how-it-works" className={styles.heroLearn}>
              See how it works
            </a>
          </div>
        </div>
      </div>

      <section className={styles.section} id="how-it-works">
        <h2 className={styles.sectionTitle}>Getting started in 4 steps</h2>
        <div className={styles.steps}>
          {STEPS.map((step, i) => (
            <div key={step.title} className={styles.step}>
              <div className={styles.stepNumber}>{i + 1}</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Difficulty levels</h2>
        <p className={styles.sectionSubtitle}>
          Levels use the CEFR scale, the international standard for language ability. Click the
          chart icon on a transcribed episode, and PodMind estimates its level from the
          transcript itself: sentence length, word length, and how fast people speak.
        </p>
        <div className={styles.levels}>
          {LEVELS.map((item) => (
            <div key={item.level} className={styles.levelCard}>
              <div className={styles.levelHeader}>
                <DifficultyBadge level={item.level} />
                <span className={styles.levelTitle}>{item.title}</span>
                <span className={styles.levelWpm}>{item.wpm}</span>
              </div>
              <p className={styles.levelDesc}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tips for faster progress</h2>
        <div className={styles.tips}>
          {TIPS.map((item, i) => (
            <div key={item.tip} className={styles.tip}>
              <span className={styles.tipEmoji}>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className={styles.tipTitle}>{item.tip}</h3>
                <p className={styles.tipDetail}>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.cta}>
        <h2 className={styles.ctaTitle}>Ready to start?</h2>
        <p className={styles.ctaSubtitle}>
          No account needed. Your words and progress are saved in this browser.
        </p>
        <Link href="/" className={styles.ctaBtn}>
          Open your library
        </Link>
      </div>
    </main>
  )
}