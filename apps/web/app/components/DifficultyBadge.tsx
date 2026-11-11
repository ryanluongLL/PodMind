import styles from "./DifficultyBadge.module.css"

/// CEFR level badge. Three calm tones from the site palette instead of six
/// bright colors: green for A (easier), amber for B, ink for C (harder). The
/// level code itself carries the exact level, so color is never the only
/// signal, and every tone passes WCAG AA contrast at this small size.
const LEVEL_CONFIG: Record<string, { tone: "easy" | "medium" | "hard"; label: string }> = {
  A1: { tone: "easy", label: "Beginner" },
  A2: { tone: "easy", label: "Elementary" },
  B1: { tone: "medium", label: "Intermediate" },
  B2: { tone: "medium", label: "Upper intermediate" },
  C1: { tone: "hard", label: "Advanced" },
  C2: { tone: "hard", label: "Proficient" },
}

export function DifficultyBadge({ level }: { level: string }) {
  const config = LEVEL_CONFIG[level]

  let className = styles.badge
  let label = level
  if (config) {
    className = `${styles.badge} ${styles[config.tone]}`
    label = config.label
  }

  return (
    <span className={className} title={label} aria-label={`Level ${level}, ${label}`}>
      {level}
    </span>
  )
}