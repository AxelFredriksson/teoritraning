// Keeps the home-screen app on the newest version.
// iOS keeps a home-screen PWA suspended for days, so the service worker's update check on page
// load rarely runs. We register immediately (vite-plugin-pwa's autoUpdate reloads the page once a
// new version takes over) and also ask for an update every time the app returns to the foreground.

interface Registration {
  update: () => Promise<unknown>
}

export type RegisterSW = (opts: {
  immediate?: boolean
  onRegisteredSW?: (swUrl: string, registration: Registration | undefined) => void
}) => (reloadPage?: boolean) => Promise<void>

export function startUpdates(register: RegisterSW) {
  let registration: Registration | undefined
  register({
    immediate: true,
    onRegisteredSW: (_url, r) => {
      registration = r
    },
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration?.update().catch(() => {})
  })
}
