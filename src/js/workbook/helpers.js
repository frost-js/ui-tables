/**
 * Convert a column number to name.
 * @param {number} num The number.
 * @returns {string} The column name.
 */
export function colName(num) {
    const code = 65 + ((num - 1) % 26);
    const letter = String.fromCharCode(code);

    const nextNum = Math.round((num - 1) / 26);

    if (nextNum > 0) {
        return colName(nextNum) + letter;
    }

    return letter;
};

/**
 * Escape a string for Excel.
 * @param {string} string The input string.
 * @returns {string} The escaped string.
 */
export function escape(string) {
    string = string.replace('&', '&amp;');
    string = string.replace('<', '&lt;');
    string = string.replace('>', '&gt;');
    string = string.replace('\x03', '');

    return string;
};

/**
 * Convert a date to Excel format.
 * @param {number} year The year.
 * @param {number} month The month.
 * @param {number} day The day.
 * @param {number} [hours] The hours.
 * @param {number} [minutes] The minutes.
 * @param {number} [seconds] The seconds.
 * @returns {number} The Excel timestamp.
 */
export function formatDate(year, month, day, hours = 0, minutes = 0, seconds = 0) {
    const time = ((hours * 3600) + (minutes * 60) + seconds) / 86400;

    if (!year) {
        return time;
    }

    let leapAdjust = 1;
    if (year == 1900 && month <= 2) {
        leapAdjust = 0;
    }

    if (month > 2) {
        month -= 3;
    } else {
        month += 9;
        year--;
    }

    const century = year.substring(0, 2);
    const decade = year.substring(2);

    return Math.floor((146097 * century) / 4) + Math.floor((1461 * decade) / 4) + Math.floor((153 * (month + 2)) / 5) + day + 1721119 - 2415020 + leapAdjust;
};
