'use client'

import { useState } from "react"
import { X } from "lucide-react"
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addPodcast } from "@/lib/api"
import styles from './AddPodcastModal.module.css'

export function AddPodcastModal({ onClose }: { onClose: () => void }) {
    const [url, setUrl] = useState('')
    const [error, setError] = useState('')
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: addPodcast,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['podcasts'] })
            onClose()
        },

        onError: () => {
            setError('Failed to add podcast. Check the URL and try again.')
        },
    })

    const handleSave = () => {
        if (!url.startsWith('http')) {
            setError('Please enter a valid URL')
            return
        }
        setError('')
        mutation.mutate(url)
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Add a podcast</h2>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                <label className={styles.label}>Podbean URL or RSS feed</label>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://feeds.simplecast.com/..."
                    className={styles.input}
                />

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.actions}>
                    <button onClick={onClose} className={styles.cancelBtn}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={mutation.isPending}
                        className={styles.saveBtn}
                    >
                        {mutation.isPending ? 'Adding...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}