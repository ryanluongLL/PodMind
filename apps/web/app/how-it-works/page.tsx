'use client'

import { Mic, BookMarked, Sparkles, Search, Globe, BarChart2 } from 'lucide-react'
import { DifficultyBadge } from '@/app/components/DifficultyBadge'
import styles from './page.module.css'
import { SignUpButton, SignInButton } from '@clerk/nextjs'

export default function HowItWorksPage() {
  return (
    <main className={styles.main}>

      {/* Hero banner — full width gradient section at the top */}
      <div className={styles.heroBanner}>
        <div className={styles.topNav}>
          <span className={styles.logo}>PodMind</span>
          <SignInButton mode="modal">
            <button className={styles.signInBtn}>Sign in</button>
          </SignInButton>
        </div>

        <div className={styles.heroContent}>
          <span className={styles.heroPill}>🎧 AI-powered English learning</span>
          <h1 className={styles.heroTitle}>
            Master English with<br />real podcasts
          </h1>
          <p className={styles.heroDesc}>
            Most language apps teach you with fake dialogues. PodMind teaches you
            from how people actually speak — comedians, journalists, scientists, storytellers.
            Click any word to translate it. Save it. Review it forever.
          </p>
          <div className={styles.heroActions}>
            <SignUpButton mode="modal">
              <button className={styles.heroCta}>Get started free</button>
            </SignUpButton>
            <a href="#how-it-works" className={styles.heroLearn}>
              See how it works ↓
            </a>
          </div>

          <div className={styles.featurePills}>
            {[
              '✦ Real podcast content',
              '✦ Word-level timestamps',
              '✦ Click-to-translate',
              '✦ Spaced repetition',
              '✦ CEFR difficulty rating',
            ].map((f) => (
              <span key={f} className={styles.featurePill}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Steps */}
      <section className={styles.section} id="how-it-works">
        <h2 className={styles.sectionTitle}>Getting started in 4 steps</h2>

        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Add a podcast</h3>
              <p className={styles.stepDesc}>
                Click <strong>Add podcast</strong> on the home page and search for any English-language podcast.
                PodMind pulls episodes directly from the podcast&apos;s RSS feed — any podcast works.
                You can also browse curated recommendations on the <strong>Discover</strong> page.
              </p>
            </div>
            <div className={styles.stepIcon}><Search size={28} /></div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Transcribe an episode</h3>
              <p className={styles.stepDesc}>
                Click the <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> icon
                on any episode to transcribe it. PodMind uses OpenAI Whisper to generate a
                word-for-word transcript with precise timestamps — this takes 1-3 minutes depending
                on episode length. Once done, you&apos;ll see <strong>Transcript ready</strong> on the episode.
              </p>
            </div>
            <div className={styles.stepIcon}><Mic size={28} /></div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Listen and learn</h3>
              <p className={styles.stepDesc}>
                Click any episode to expand its synchronized transcript. As the audio plays,
                the current sentence highlights automatically. <strong>Click any word</strong> to
                instantly see its translation in your native language, its definition, usage notes,
                and an example sentence. Click <strong>Save to vocabulary</strong> to add it to your deck.
              </p>
            </div>
            <div className={styles.stepIcon}><Globe size={28} /></div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>4</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Review your vocabulary</h3>
              <p className={styles.stepDesc}>
                Visit <strong>Vocabulary</strong> to see all words you&apos;ve saved.
                Click <strong>Start review</strong> to practice with flashcards —
                PodMind uses the SM-2 spaced repetition algorithm (the same one used by Anki)
                to schedule reviews at the optimal time for long-term retention.
                Rate yourself after each card and the algorithm adjusts automatically.
              </p>
            </div>
            <div className={styles.stepIcon}><BookMarked size={28} /></div>
          </div>
        </div>
      </section>

      {/* Difficulty levels */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <BarChart2 size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Difficulty levels explained
        </h2>
        <p className={styles.sectionSubtitle}>
          PodMind uses the CEFR (Common European Framework of Reference) scale —
          the international standard for measuring language proficiency.
          Click the <BarChart2 size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> icon
          on any transcribed episode to rate its difficulty.
        </p>

        <div className={styles.levels}>
          {[
            { level: 'A1', title: 'Beginner', wpm: '< 100 wpm', desc: 'Very simple vocabulary, short sentences, slow speaking pace. Good for absolute beginners who know basic greetings and phrases.' },
            { level: 'A2', title: 'Elementary', wpm: '100-120 wpm', desc: 'Everyday vocabulary on familiar topics like food, travel, and family. Sentences are simple but connected.' },
            { level: 'B1', title: 'Intermediate', wpm: '120-140 wpm', desc: 'Most everyday situations, some idioms and phrasal verbs. This is where most learners feel comfortable but still encounter unknown words regularly.' },
            { level: 'B2', title: 'Upper-Intermediate', wpm: '140-160 wpm', desc: 'Complex topics, abstract ideas, natural conversational pace. Speakers may use humor, sarcasm, and cultural references.' },
            { level: 'C1', title: 'Advanced', wpm: '160-180 wpm', desc: 'Fluent, nuanced speech with sophisticated vocabulary. Academic and professional topics discussed naturally.' },
            { level: 'C2', title: 'Proficient', wpm: '> 180 wpm', desc: 'Near-native speech, including regional accents, slang, subtle cultural references, and very fast delivery.' },
          ].map((item) => (
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

      {/* Tips */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tips for faster progress</h2>
        <div className={styles.tips}>
          {[
            { emoji: '🎯', tip: 'Start one level below your comfort zone', detail: "If you think you're B2, listen to B1 content first. You'll understand 90%+ which builds confidence and makes new words easier to absorb." },
            { emoji: '📅', tip: 'Review every day, even for 5 minutes', detail: 'Spaced repetition only works if you show up consistently. Even reviewing 3-4 words a day is better than a 30-minute session once a week.' },
            { emoji: '🎧', tip: 'Use the speed control', detail: "Start at 0.75x for difficult episodes. Once you understand everything at normal speed, try 1.25x — your brain adapts and normal speech starts to feel slow." },
            { emoji: '📝', tip: 'Save words in context, not in isolation', detail: "PodMind saves the full sentence with each word. When reviewing, read the context sentence — this is how your brain builds real vocabulary, not just memorized definitions." },
          ].map((item) => (
            <div key={item.emoji} className={styles.tip}>
              <span className={styles.tipEmoji}>{item.emoji}</span>
              <div>
                <h3 className={styles.tipTitle}>{item.tip}</h3>
                <p className={styles.tipDetail}>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className={styles.cta}>
        <h2 className={styles.ctaTitle}>Ready to start?</h2>
        <p className={styles.ctaSubtitle}>Free to use. No credit card required.</p>
        <SignUpButton mode="modal">
          <button className={styles.ctaBtn}>Get started free</button>
        </SignUpButton>
      </div>

    </main>
  )
}