const encoder = new TextEncoder();

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
