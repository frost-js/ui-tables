/**
 * Converts a one-based Excel column number to its letter name.
 * @param {number} num The column number.
 * @returns {string} The column name.
 */
export function colName(num) {
    if (!Number.isInteger(num) || num < 1) {
        throw new RangeError('Column must be a positive integer.');
    }
    let result = '';
    while (num) {
        num--;
        result = String.fromCharCode(65 + num % 26) + result;
        num = Math.floor(num / 26);
    }
    return result;
}

/**
 * Escapes XML text and attributes, removing characters forbidden by XML 1.0.
 * @param {string} string The input text.
 * @returns {string} The escaped text.
 */
export function escape(string) {
    return Array.from(String(string)).filter((character) => {
        const code = character.codePointAt(0);
        return (code >= 32 || [9, 10, 13].includes(code)) && code !== 0xfffe && code !== 0xffff;
    }).join('')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll('\'', '&apos;');
}

/**
 * Converts date parts to the Excel 1900 date system, including its leap-day convention.
 * @param {number|string} year The year; zero represents a time without a date.
 * @param {number|string} month The one-based month.
 * @param {number|string} day The day.
 * @param {number|string} [hours=0] The hours.
 * @param {number|string} [minutes=0] The minutes.
 * @param {number|string} [seconds=0] The seconds.
 * @returns {number} The Excel serial value.
 */
export function formatDate(year, month, day, hours = 0, minutes = 0, seconds = 0) {
    [year, month, day, hours, minutes, seconds] = [year, month, day, hours, minutes, seconds].map(Number);
    if (
        ![year, month, day, hours, minutes, seconds].every(Number.isInteger) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59 ||
        seconds < 0 ||
        seconds > 59
    ) {
        throw new RangeError('Invalid date or time.');
    }
    const fraction = (hours * 3600 + minutes * 60 + seconds) / 86400;
    if (!year) {
        return fraction;
    }
    if (year === 1900 && month === 2 && day === 29) {
        return 60 + fraction;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        year < 1900 ||
        year > 9999 ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new RangeError('Invalid date.');
    }
    const days = (date.getTime() - Date.UTC(1899, 11, 31)) / 86400000;
    return days + (days >= 60 ? 1 : 0) + fraction;
}
