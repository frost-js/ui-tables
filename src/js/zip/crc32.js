import { getCrc32Table } from './helpers.js';

/**
 * Calculates and updates ZIP CRC32 checksums.
 * Adapted from https://github.com/imaya/zlib.js/blob/develop/src/crc32.js
 */
export default class CRC32 {
    /**
     * Gets the CRC32 hash value.
     * @param {Uint8Array} data The data to hash.
     * @param {number} [position] The data position.
     * @param {number} [length] The data length.
     * @returns {number} The CRC32 hash.
     */
    static calc(data, position = 0, length = null) {
        return this.update(data, 0, position, length);
    }

    /**
     * Updates the CRC32 hash value.
     * @param {Uint8Array} data The data to hash.
     * @param {number} checksum The CRC32 hash.
     * @param {number} [position] The data position.
     * @param {number} [length] The data length.
     * @returns {number} The CRC32 hash.
     */
    static update(data, checksum, position = 0, length = null) {
        if (length === null) {
            length = data.length;
        }

        checksum ^= 0xffffffff;

        const table = getCrc32Table();

        // Handle the remainder first, then process complete groups of eight bytes.
        for (let i = length & 7; i--; ++position) {
            checksum = (checksum >>> 8) ^ table[(checksum ^ data[position]) & 0xff];
        }

        for (let i = length >> 3; i--; position += 8) {
            checksum = (checksum >>> 8) ^ table[(checksum ^ data[position]) & 0xff];
            checksum = (checksum >>> 8) ^ table[(checksum ^ data[position + 1]) & 0xff];
            checksum = (checksum >>> 8) ^ table[(checksum ^ data[position + 2]) & 0xff];
            checksum = (checksum >>> 8) ^ table[(checksum ^ data[position + 3]) & 0xff];
            checksum = (checksum >>> 8) ^ table[(checksum ^ data[position + 4]) & 0xff];
            checksum = (checksum >>> 8) ^ table[(checksum ^ data[position + 5]) & 0xff];
            checksum = (checksum >>> 8) ^ table[(checksum ^ data[position + 6]) & 0xff];
            checksum = (checksum >>> 8) ^ table[(checksum ^ data[position + 7]) & 0xff];
        }

        return (checksum ^ 0xffffffff) >>> 0;
    }
}
