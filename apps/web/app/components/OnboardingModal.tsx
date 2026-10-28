"use client"

import { useState } from "react"
import {
  NATIVE_LANGUAGES,
  ENGLISH_LEVELS,
  type NativeLanguageCode,
  type EnglishLevelCode,
} from "@/lib/constant"
import { saveProfile } from "@/lib/localStore"
import styles from "./OnboardingModal.module.css"

const GOAL_OPTIONS = [10, 15, 30, 60]
const TOTAL_STEPS = 3

/// First visit setup. Collects the native language (translation target),
/// English level (used by the coverage recommender), and a daily listening
/// goal. Saving sets onboarded to true, and the home page hides this modal
/// automatically because it reads the same profile from localStorage.
export function OnboardingModal() {
  const [step, setStep] = useState(0)
  const [nativeLanguage, setNativeLanguage] = useState<NativeLanguageCode>("vi")
  const [englishLevel, setEnglishLevel] = useState<EnglishLevelCode>("B1")
  const [dailyGoal, setDailyGoal] = useState(15)

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1)
      return
    }
    saveProfile({
      nativeLanguage,
      englishLevel,
      dailyGoalMinutes: dailyGoal,
      onboarded: true,
    })
  }

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  let primaryLabel = "Continue"
  if (step === 0) {
    primaryLabel = "Get started"
  } else if (step === TOTAL_STEPS - 1) {
    primaryLabel = "Start learning"
  }

  const segments = []
  for (let i = 0; i < TOTAL_STEPS; i++) {
    let className = styles.segment
    if (i <= step) {
      className = `${styles.segment} ${styles.segmentOn}`
    }
    segments.push(<span key={i} className={className} />)
  }

  return (
    <div className={styles.overlay}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <p className={styles.stepLabel}>
          Step {step + 1} of {TOTAL_STEPS}
        </p>
        <div className={styles.progress} aria-hidden="true">
          {segments}
        </div>

        {step === 0 && (
          <>
            <h2 id="onboarding-title" className={styles.title}>
              Welcome to PodMind
            </h2>
            <p className={styles.subtitle}>
              Learn English from real podcasts. Click any word in a transcript to see what
              it means, save it, and review it later. Two quick questions and you&apos;re in.
            </p>
            <p className={styles.note}>
              No account needed. Your words and progress are saved in this browser.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <h2 id="onboarding-title" className={styles.title}>
              What&apos;s your native language?
            </h2>
            <p className={styles.subtitle}>
              Words you click will be translated into this language.
            </p>
            <div className={styles.languageGrid}>
              {NATIVE_LANGUAGES.map((lang) => {
                let className = styles.option
                if (nativeLanguage === lang.code) {
                  className = `${styles.option} ${styles.optionActive}`
                }
                return (
                  <button
                    key={lang.code}
                    onClick={() => setNativeLanguage(lang.code)}
                    className={className}
                    aria-pressed={nativeLanguage === lang.code}
                  >
                    <span className={styles.optionTitle}>{lang.label}</span>
                    <span className={styles.optionSub}>{lang.english}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 id="onboarding-title" className={styles.title}>
              How well do you understand spoken English?
            </h2>
            <p className={styles.subtitle}>Pick the one that sounds most like you.</p>
            <div className={styles.levelList}>
              {ENGLISH_LEVELS.map((level) => {
                let className = styles.option
                if (englishLevel === level.code) {
                  className = `${styles.option} ${styles.optionActive}`
                }
                return (
                  <button
                    key={level.code}
                    onClick={() => setEnglishLevel(level.code)}
                    className={className}
                    aria-pressed={englishLevel === level.code}
                  >
                    <span className={styles.optionTitle}>{level.label}</span>
                    <span className={styles.optionSub}>{level.description}</span>
                  </button>
                )
              })}
            </div>

            <span className={styles.goalLabel}>Daily listening goal</span>
            <div className={styles.goalRow}>
              {GOAL_OPTIONS.map((minutes) => {
                let className = styles.goalChip
                if (dailyGoal === minutes) {
                  className = `${styles.goalChip} ${styles.goalChipActive}`
                }
                return (
                  <button
                    key={minutes}
                    onClick={() => setDailyGoal(minutes)}
                    className={className}
                    aria-pressed={dailyGoal === minutes}
                  >
                    {minutes} min
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className={styles.navRow}>
          {step > 0 && (
            <button onClick={goBack} className={styles.secondaryBtn}>
              Back
            </button>
          )}
          <button onClick={goNext} className={styles.primaryBtn}>
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}