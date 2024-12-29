// Add window interface extension
declare global {
    interface Window {
        plausible?: (eventName: string, options?: PlausibleOptions) => void
    }
}

interface PlausibleOptions {
    callback?: () => void
    props?: Record<string, any>
}

export function plausibleEvent(eventName: string, options: PlausibleOptions = {}) {
    if (typeof window !== 'undefined' && window.plausible) {
        window.plausible(eventName, options)
    }
}
