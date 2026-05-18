import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import { AudioPlayer } from './components/AudioPlayer'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'PodMind',
  description: 'AI-powered semantic podcast search',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <Providers>
            {children}
             <Toaster position="bottom-center" richColors />
            <AudioPlayer />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}