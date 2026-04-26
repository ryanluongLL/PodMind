import { useEffect, useState } from "react";


///returns a value that only updates after the user stops changing it for `delay` ms
///used to avoid hitting the iTunes API on every keystroke

export function useDebounce<T>(value: T, delay: number): T{
    const [debounced, setDebounced] = useState(value)

    useEffect(() => {
        const handle = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(handle)
    }, [value, delay])

    return debounced
}