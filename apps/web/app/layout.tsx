import type { Metadata } from "next"
import { Toaster } from "sonner"
import { Providers } from "./providers"
import { AudioPlayer } from "./components/AudioPlayer"
import "./globals.css"

export const metadata: Metadata = {
  title: "PodMind",
  description:
    "Learn English from real podcasts with synchronized transcripts, word lookup, and spaced repetition.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <Toaster position="bottom-center" richColors />
          <AudioPlayer />
        </Providers>
      </body>
    </html>
  )
}