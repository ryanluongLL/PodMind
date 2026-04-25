'use client'

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import {setupAuthInterceptor} from '@/lib/api'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())
    const { getToken } = useAuth()
    ///wire up the Axios interceptor once on mount so every API call automatically includes the Clerk JWT in the Authorization header
    useEffect(() => {
        setupAuthInterceptor(getToken)
    }, [getToken])

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}