const encoder = new TextEncoder();

let bitReverseTable = null;
let crc32Table = null;

/**
 * Encodes a string as UTF-8 bytes.
 * @param {string} string The string.
 * @returns {Uint8Array} The encoded string.
 */
export function encode(string) {
    return encoder.encode(string);
}

/**
 * Gets the UTF-8 byte length of a string.
 * @param {string} string The string.
 * @returns {number} The byte length.
 */
export function byteLength(string) {
    return encode(string).length;
}

/**
 * Encodes an unsigned 16-bit integer in little-endian byte order.
 * @param {number} number The number.
 * @returns {Uint8Array} The encoded bytes.
 */
export function encodeUint16(number) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, number, true);

    return bytes;
}

/**
 * Encodes an unsigned 32-bit integer in little-endian byte order.
 * @param {number} number The number.
 * @returns {Uint8Array} The encoded bytes.
 */
export function encodeUint32(number) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, number, true);

    return bytes;
}

/**
 * Gets the cached bit reversal table for all possible byte values.
 * @returns {Uint8Array} The bit reversal table.
 */
function getBitReverseTable() {
    if (bitReverseTable === null) {
        bitReverseTable = new Uint8Array(256);

        for (let byte = 0; byte < 256; byte++) {
            let remaining = byte;
            let reversed = remaining;
            let shift = 7;

            for (remaining >>>= 1; remaining; remaining >>>= 1) {
                reversed <<= 1;
                reversed |= remaining & 1;
                shift--;
            }

            bitReverseTable[byte] = (reversed << shift & 0xff) >>> 0;
        }
    }

    return bitReverseTable;
}

/**
 * Reverses the bits within a byte.
 * @param {number} byte The byte to reverse.
 * @returns {number} The reversed number.
 */
export function reverseByte(byte) {
    return getBitReverseTable()[byte];
}

/**
 * Reverses all 32 bits of an integer.
 * @param {number} number The number to reverse.
 * @returns {number} The reversed number.
 */
export function reverseUint32(number) {
    const table = getBitReverseTable();

    return (table[number & 0xff] << 24) |
        (table[number >>> 8 & 0xff] << 16) |
        (table[number >>> 16 & 0xff] << 8) |
        table[number >>> 24 & 0xff];
}

/**
 * Gets the cached CRC32 table for the polynomial used by ZIP.
 * @returns {Uint32Array} The CRC32 table.
 */
export function getCrc32Table() {
    if (!crc32Table) {
        crc32Table = new Uint32Array(256);

        for (let i = 0; i < 256; i++) {
            let checksum = i;

            for (let j = 0; j < 8; j++) {
                checksum = (checksum & 1) ? (0xedb88320 ^ (checksum >>> 1)) : (checksum >>> 1);
            }

            crc32Table[i] = checksum >>> 0;
        }
    }

    return crc32Table;
}
