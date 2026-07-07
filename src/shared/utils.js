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

/**
 * Formats a stream label for consistent display.
 */
export function formatStreamLabel(siteName, providerName, quality) {
    const res = quality ? quality.toUpperCase() : 'AUTO';
    return `${res} • ${siteName} • ${providerName}`;
}

/**
 * Constructs a DLE-style tooltip string from metadata.
 */
export function formatTooltip(meta, siteName, res) {
    if (!meta || !meta.tmdb) return null;

    const { tmdb } = meta;
    const titleLine = tmdb.title || '';
    const runtimeLine = tmdb.runtime ? `⏱️ ${tmdb.runtime} min` : '';
    const directorLine = tmdb.director && tmdb.director[0] ? `🎬 ${tmdb.director[0].name}` : '';
    const castLine = tmdb.cast && tmdb.cast.length > 0 ? `👥 ${tmdb.cast.map(c => c.name).join(', ')}` : '';
    const genreLine = tmdb.genres && tmdb.genres.length > 0 ? `🎭 ${tmdb.genres.join(', ')}` : '';
    
    const adultLabels = [];
    if (tmdb.adult) adultLabels.push('adult:true');
    if (tmdb.rated) adultLabels.push(`rated:${tmdb.rated}`);
    if (adultLabels.length === 0) adultLabels.push('adult:true');
    const warningLine = `🔞 ${adultLabels.join(' │ ')}`;

    const descParts = [
        titleLine,
        `${res.toUpperCase()} ${runtimeLine ? ' │ ' + runtimeLine : ''}`,
        `🌐 Source: ${siteName}`,
        warningLine,
        genreLine,
        directorLine,
        castLine,
        `✅ Verified`
    ].filter(Boolean);

    return descParts.join('\n');
}
