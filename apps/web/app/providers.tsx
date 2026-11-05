"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PlayerProvider } from "@/lib/playerStore"

/// App wide providers: React Query for server data (the shared podcast
/// library) and the audio player. Personal data lives in localStorage and
/// is read through the hooks in lib/localStore, so it needs no provider.
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>{children}</PlayerProvider>
    </QueryClientProvider>
  )
}