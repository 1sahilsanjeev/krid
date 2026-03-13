const STORAGE_KEY = "gridless_ai_key";

/**
 * Saves the AI key to localStorage after basic encoding.
 * @param key The plain text AI key to save.
 */
export function saveAIKey(key: string): void {
    try {
        // Use encodeURIComponent to handle special characters safely before base64
        const encodedKey = btoa(encodeURIComponent(key.trim()));
        localStorage.setItem(STORAGE_KEY, encodedKey);
    } catch (e) {
        console.error("Failed to save AI key", e);
        // Fallback to storing raw if btoa fails for some unusual reason
        localStorage.setItem(STORAGE_KEY, key.trim());
    }
}

/**
 * Retrieves and decodes the AI key from localStorage.
 * Returns null if the key doesn't exist or if decoding fails.
 */
export function getAIKey(): string | null {
    const encodedKey = localStorage.getItem(STORAGE_KEY);
    if (!encodedKey) return null;

    try {
        return decodeURIComponent(atob(encodedKey));
    } catch (error) {
        // If decoding fails, it might be an old unencoded key or corrupted
        // Try returning it raw as a fallback, or return null if it's too broken
        if (encodedKey.startsWith('sk-ant-')) {
            return encodedKey;
        }
        return null;
    }
}

/**
 * Removes the AI key from localStorage.
 */
export function removeAIKey(): void {
    localStorage.removeItem(STORAGE_KEY);
}
