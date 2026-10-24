let lengthCodeTable = null;

/**
 * Gets the DEFLATE symbol, extra-bit value, and bit count for a match length.
 * @param {number} length The length.
 * @returns {[number, number, number]} The length symbol, extra-bit value, and bit count.
 */
function generateLengthCodes(length) {
    switch (true) {
        case length === 3:
            return [257, length - 3, 0];
        case length === 4:
            return [258, length - 4, 0];
        case length === 5:
            return [259, length - 5, 0];
        case length === 6:
            return [260, length - 6, 0];
        case length === 7:
            return [261, length - 7, 0];
        case length === 8:
            return [262, length - 8, 0];
        case length === 9:
            return [263, length - 9, 0];
        case length === 10:
            return [264, length - 10, 0];
        case length <= 12:
            return [265, length - 11, 1];
        case length <= 14:
            return [266, length - 13, 1];
        case length <= 16:
            return [267, length - 15, 1];
        case length <= 18:
            return [268, length - 17, 1];
        case length <= 22:
            return [269, length - 19, 2];
        case length <= 26:
            return [270, length - 23, 2];
        case length <= 30:
            return [271, length - 27, 2];
        case length <= 34:
            return [272, length - 31, 2];
        case length <= 42:
            return [273, length - 35, 3];
        case length <= 50:
            return [274, length - 43, 3];
        case length <= 58:
            return [275, length - 51, 3];
        case length <= 66:
            return [276, length - 59, 3];
        case length <= 82:
            return [277, length - 67, 4];
        case length <= 98:
            return [278, length - 83, 4];
        case length <= 114:
            return [279, length - 99, 4];
        case length <= 130:
            return [280, length - 115, 4];
        case length <= 162:
            return [281, length - 131, 5];
        case length <= 194:
            return [282, length - 163, 5];
        case length <= 226:
            return [283, length - 195, 5];
        case length <= 257:
            return [284, length - 227, 5];
        case length === 258:
            return [285, length - 258, 0];
    }
}

/**
 * Gets the cached length codes for DEFLATE matches of 3 to 258 bytes.
 * @returns {number[]} The packed length code table.
 */
function getLengthCodeTable() {
    if (!lengthCodeTable) {
        lengthCodeTable = [];

        for (let i = 3; i <= 258; i++) {
            const codes = generateLengthCodes(i);

            // Pack the symbol into 16 bits, followed by the extra value and bit count in 8 bits each.
            lengthCodeTable[i] = (codes[2] << 24) | (codes[1] << 16) | codes[0];
        }
    }

    return lengthCodeTable;
}

/**
 * Gets the distance code.
 * @param {number} distance The distance.
 * @returns {[number, number, number]} The distance symbol, extra-bit value, and bit count.
 */
export function getDistanceCode(distance) {
    switch (true) {
        case distance === 1:
            return [0, distance - 1, 0];
        case distance === 2:
            return [1, distance - 2, 0];
        case distance === 3:
            return [2, distance - 3, 0];
        case distance === 4:
            return [3, distance - 4, 0];
        case distance <= 6:
            return [4, distance - 5, 1];
        case distance <= 8:
            return [5, distance - 7, 1];
        case distance <= 12:
            return [6, distance - 9, 2];
        case distance <= 16:
            return [7, distance - 13, 2];
        case distance <= 24:
            return [8, distance - 17, 3];
        case distance <= 32:
            return [9, distance - 25, 3];
        case distance <= 48:
            return [10, distance - 33, 4];
        case distance <= 64:
            return [11, distance - 49, 4];
        case distance <= 96:
            return [12, distance - 65, 5];
        case distance <= 128:
            return [13, distance - 97, 5];
        case distance <= 192:
            return [14, distance - 129, 6];
        case distance <= 256:
            return [15, distance - 193, 6];
        case distance <= 384:
            return [16, distance - 257, 7];
        case distance <= 512:
            return [17, distance - 385, 7];
        case distance <= 768:
            return [18, distance - 513, 8];
        case distance <= 1024:
            return [19, distance - 769, 8];
        case distance <= 1536:
            return [20, distance - 1025, 9];
        case distance <= 2048:
            return [21, distance - 1537, 9];
        case distance <= 3072:
            return [22, distance - 2049, 10];
        case distance <= 4096:
            return [23, distance - 3073, 10];
        case distance <= 6144:
            return [24, distance - 4097, 11];
        case distance <= 8192:
            return [25, distance - 6145, 11];
        case distance <= 12288:
            return [26, distance - 8193, 12];
        case distance <= 16384:
            return [27, distance - 12289, 12];
        case distance <= 24576:
            return [28, distance - 16385, 13];
        case distance <= 32768:
            return [29, distance - 24577, 13];
    }
}

/**
 * Gets the length code.
 * @param {number} length The length.
 * @returns {number} The length code.
 */
export function getLengthCode(length) {
    return getLengthCodeTable()[length];
}
