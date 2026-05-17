import styles from './DifficultyBadge.module.css'

const LEVEL_CONFIG: Record<string, { color: string; label: string }> = {
  A1: { color: '#22c55e', label: 'Beginner' },
  A2: { color: '#86efac', label: 'Elementary' },
  B1: { color: '#f59e0b', label: 'Intermediate' },
  B2: { color: '#f97316', label: 'Upper-Inter' },
  C1: { color: '#ef4444', label: 'Advanced' },
  C2: { color: '#7c3aed', label: 'Proficient' },
}

export function DifficultyBadge({ level }: { level: string }) {
    const config = LEVEL_CONFIG[level] ?? { color: '#9ca3af', label: level }
    
    return (
        <span
            className={styles.badge}
            style={{ background: `${config.color}20`, color: config.color, borderColor: `${config.color}40` }}
            title={config.label}
        >
            {level}
        </span>
    )
}