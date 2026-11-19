import Link from "next/link"
import { EyeOff, RotateCcw } from "lucide-react"
import type { Podcast } from "@/lib/api"
import styles from "./PostcastCard.module.css"

/// One podcast in the library grid. The cover art is the card. The title is
/// an h2 because the page heading ("Your library") is the h1, and screen
/// reader users jump between headings by level.
///
/// The hide or restore button sits next to the link, not inside it, because
/// a button inside a link is invalid HTML and confuses screen readers.
export function PodcastCard({
  podcast,
  hidden = false,
  onHide,
  onRestore,
}: {
  podcast: Podcast
  hidden?: boolean
  onHide?: (podcast: Podcast) => void
  onRestore?: (podcast: Podcast) => void
}) {
  let actionButton = null
  if (hidden && onRestore) {
    actionButton = (
      <button
        type="button"
        onClick={() => onRestore(podcast)}
        className={`${styles.actionBtn} ${styles.actionBtnVisible}`}
        aria-label={`Restore ${podcast.name} to my library`}
        title="Restore to my library"
      >
        <RotateCcw size={16} />
      </button>
    )
  } else if (!hidden && onHide) {
    actionButton = (
      <button
        type="button"
        onClick={() => onHide(podcast)}
        className={styles.actionBtn}
        aria-label={`Remove ${podcast.name} from my library`}
        title="Remove from my library"
      >
        <EyeOff size={16} />
      </button>
    )
  }

  return (
    <div className={`${styles.card} ${hidden ? styles.cardHidden : ""}`}>
      <Link href={`/podcast/${podcast.id}`} className={styles.link}>
        <div className={styles.coverWrapper}>
          {podcast.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={podcast.icon_url} alt={podcast.name} className={styles.cover} />
          ) : (
            <div className={styles.coverFallback} aria-hidden="true">
              {podcast.name.charAt(0)}
            </div>
          )}
        </div>
        <h2 className={styles.title}>{podcast.name}</h2>
        <p className={styles.episodeCount}>{podcast.episode_count} episodes</p>
      </Link>
      {actionButton}
    </div>
  )
}