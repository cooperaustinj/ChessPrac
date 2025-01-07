const soundCache = new Map<string, HTMLAudioElement>()

export const createSound = (src: string): HTMLAudioElement => {
    let sound = soundCache.get(src)
    if (!sound) {
        sound = new Audio(src)
        soundCache.set(src, sound)
    }
    return sound
}

export const playSound = (sound: HTMLAudioElement) => {
    // Stop all currently playing sounds
    soundCache.forEach(cachedSound => {
        cachedSound.pause()
        cachedSound.currentTime = 0
    })

    // Play the new sound
    sound.currentTime = 0
    sound.play().catch(err => console.error('Error playing sound:', err))
}
