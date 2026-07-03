/**
 * Cleans a title by lowercasing and removing non-alphanumeric characters.
 */
export function cleanTitle(title) {
    if (!title) return "";
    return title.toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Checks if a result title matches the expected metadata title.
 * Handles partial matches and common suffixes like "Full Movie".
 */
export function isMatch(resultTitle, expectedTitle) {
    if (!resultTitle || !expectedTitle) return false;
    
    const cleanResult = cleanTitle(resultTitle);
    const cleanExpected = cleanTitle(expectedTitle);
    
    // Direct match
    if (cleanResult === cleanExpected) return true;
    
    // Inclusion (e.g., "Movie Title Full Movie" contains "Movie Title")
    if (cleanResult.includes(cleanExpected)) return true;
    
    // Word matching (check if all expected words are present in the result)
    const expectedWords = cleanExpected.split(" ").filter(w => w.length > 2);
    if (expectedWords.length > 0) {
        const allWordsPresent = expectedWords.every(word => cleanResult.includes(word));
        if (allWordsPresent) return true;
    }
    
    return false;
}
