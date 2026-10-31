import { useCallback, useEffect, useState } from 'react'

interface Entry<S> {
  screen: S
  depth: number
}

/**
 * Screen stack backed by the browser history, so the in-app back button,
 * the browser's back arrow and the iOS back swipe all behave the same.
 */
export function useNavigation<S>(initial: S) {
  const [entry, setEntry] = useState<Entry<S>>(() => {
    const e = { screen: initial, depth: 0 }
    window.history.replaceState({ nav: e }, '')
    return e
  })

  useEffect(() => {
    const onPop = (ev: PopStateEvent) => {
      const e = (ev.state as { nav?: Entry<S> } | null)?.nav
      setEntry(e ?? { screen: initial, depth: 0 })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // initial is only the fallback for foreign history entries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // pushState must run once per navigate, never inside a state updater (StrictMode calls those twice)
  const navigate = useCallback((screen: S) => {
    const cur = (window.history.state as { nav?: Entry<S> } | null)?.nav
    const e = { screen, depth: (cur?.depth ?? 0) + 1 }
    window.history.pushState({ nav: e }, '')
    setEntry(e)
  }, [])

  const reset = useCallback((screen: S) => {
    const e = { screen, depth: 0 }
    window.history.replaceState({ nav: e }, '')
    setEntry(e)
  }, [])

  const back = useCallback(() => {
    if (entry.depth > 0) window.history.back()
  }, [entry.depth])

  return { screen: entry.screen, navigate, back, reset, canGoBack: entry.depth > 0 }
}
