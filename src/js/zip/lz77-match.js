import { getDistanceCode, getLengthCode } from './lz77-helpers.js';

/**
 * Encodes a repeated byte sequence as DEFLATE length and distance symbols.
 * Adapted from https://github.com/imaya/zlib.js/blob/develop/src/rawdeflate.js
 */
export default class Lz77Match {
    #backwardDistance;
    #length;

    /**
     * Creates a Lz77Match.
     * @param {number} length The length of the match.
     * @param {number} backwardDistance The distance to the matching sequence.
     */
    constructor(length, backwardDistance) {
        this.#length = length;
        this.#backwardDistance = backwardDistance;
    }

    /**
     * Gets the current length.
     * @returns {number} The length.
     */
    get length() {
        return this.#length;
    }

    /**
     * Gets the LZ77 coded array.
     * @returns {number[]} The encoded length and distance symbols with their extra-bit values and bit counts.
     */
    toLz77Array() {
        const lengthCode = getLengthCode(this.#length);
        const distanceCode = getDistanceCode(this.#backwardDistance);

        // Each symbol is followed by its extra-bit value and the number of extra bits.
        return [
            lengthCode & 0xffff,
            (lengthCode >> 16) & 0xff,
            lengthCode >> 24,
            ...distanceCode,
        ];
    }
}
