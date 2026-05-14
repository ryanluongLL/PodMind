'use client'

import { useState } from "react"
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Globe, Target } from "lucide-react";
import { updateProfile } from "@/lib/api";
import { NATIVE_LANGUAGES, ENGLISH_LEVELS } from "@/lib/constant";
import styles from './OnboardingModal.module.css'

// Three-step onboarding shown on first sign-in. Collects:
//   1. Native language (so we know what to translate to)
//   2. English level (so we can filter content appropriately)
//   3. Daily listening goal (drives streak + progress tracking)
//
// On completion, sets onboarded=true so this modal never shows again.
// All settings are editable later in /settings.
export function OnboardingModal() {
    const [step, setStep] = useState(0)
    const [nativeLanguage, setNativeLanguage] = useState('vi')
    const [englishLevel, setEnglishLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('B1')
    const [dailyGoal, setDailyGoal] = useState(15)
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: () =>
            updateProfile({
                native_language: nativeLanguage,
                english_level: englishLevel,
                daily_goal_minutes: dailyGoal,
                onboarded: true,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['profile']})
        },
    })

    const goNext = () => {
        if (step < 2) setStep(step + 1)
        else mutation.mutate()
    }

    const goBack = () => {
        if(step > 0) setStep(step -1)
    }
    
    return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Progress dots — 3 steps total */}
        <div className={styles.progress}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${styles.dot} ${i <= step ? styles.dotActive : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div className={styles.step}>
            <div className={styles.iconWrapper}>
              <Sparkles size={32} />
            </div>
            <h2 className={styles.title}>Welcome to PodMind</h2>
            <p className={styles.subtitle}>
              Learn English by listening to real podcasts. Let&apos;s set up your profile in 3 quick steps.
            </p>
            <button onClick={goNext} className={styles.primaryBtn}>
              Get started
            </button>
          </div>
        )}

        {step === 1 && (
          <div className={styles.step}>
            <div className={styles.iconWrapper}>
              <Globe size={32} />
            </div>
            <h2 className={styles.title}>What&apos;s your native language?</h2>
            <p className={styles.subtitle}>
              We&apos;ll translate unfamiliar words to your language so you can learn faster.
            </p>

            <div className={styles.languageGrid}>
              {NATIVE_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setNativeLanguage(lang.code)}
                  className={`${styles.langCard} ${nativeLanguage === lang.code ? styles.langCardActive : ''}`}
                >
                  <span className={styles.langLabel}>{lang.label}</span>
                  <span className={styles.langEnglish}>{lang.english}</span>
                </button>
              ))}
            </div>

            <div className={styles.navRow}>
              <button onClick={goBack} className={styles.secondaryBtn}>Back</button>
              <button onClick={goNext} className={styles.primaryBtn}>Continue</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.step}>
            <div className={styles.iconWrapper}>
              <Target size={32} />
            </div>
            <h2 className={styles.title}>What&apos;s your English level?</h2>
            <p className={styles.subtitle}>
              We&apos;ll recommend podcasts that match your level. You can change this anytime.
            </p>

            <div className={styles.levelList}>
              {ENGLISH_LEVELS.map((level) => (
                <button
                  key={level.code}
                  onClick={() => setEnglishLevel(level.code)}
                  className={`${styles.levelCard} ${englishLevel === level.code ? styles.levelCardActive : ''}`}
                >
                  <div className={styles.levelLabel}>{level.label}</div>
                  <div className={styles.levelDescription}>{level.description}</div>
                </button>
              ))}
            </div>

            <div className={styles.goalSection}>
              <label className={styles.goalLabel}>Daily listening goal</label>
              <div className={styles.goalRow}>
                {[10, 15, 30, 60].map((min) => (
                  <button
                    key={min}
                    onClick={() => setDailyGoal(min)}
                    className={`${styles.goalChip} ${dailyGoal === min ? styles.goalChipActive : ''}`}
                  >
                    {min} min
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.navRow}>
              <button onClick={goBack} className={styles.secondaryBtn}>Back</button>
              <button
                onClick={goNext}
                disabled={mutation.isPending}
                className={styles.primaryBtn}
              >
                {mutation.isPending ? 'Saving...' : 'Start learning'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

}