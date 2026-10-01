let lengthCodeTable = null;

/**
 * Generate the length codes.
 * @param {number} length The length.
 * @returns {Array} The LZ77 length codes.
 */
const generateLengthCodes = (length) => {
    switch (true) {
        case (length === 3):
            return [257, length - 3, 0];
        case (length === 4):
            return [258, length - 4, 0];
        case (length === 5):
            return [259, length - 5, 0];
        case (length === 6):
            return [260, length - 6, 0];
        case (length === 7):
            return [261, length - 7, 0];
        case (length === 8):
            return [262, length - 8, 0];
        case (length === 9):
            return [263, length - 9, 0];
        case (length === 10):
            return [264, length - 10, 0];
        case (length <= 12):
            return [265, length - 11, 1];
        case (length <= 14):
            return [266, length - 13, 1];
        case (length <= 16):
            return [267, length - 15, 1];
        case (length <= 18):
            return [268, length - 17, 1];
        case (length <= 22):
            return [269, length - 19, 2];
        case (length <= 26):
            return [270, length - 23, 2];
        case (length <= 30):
            return [271, length - 27, 2];
        case (length <= 34):
            return [272, length - 31, 2];
        case (length <= 42):
            return [273, length - 35, 3];
        case (length <= 50):
            return [274, length - 43, 3];
        case (length <= 58):
            return [275, length - 51, 3];
        case (length <= 66):
            return [276, length - 59, 3];
        case (length <= 82):
            return [277, length - 67, 4];
        case (length <= 98):
            return [278, length - 83, 4];
        case (length <= 114):
            return [279, length - 99, 4];
        case (length <= 130):
            return [280, length - 115, 4];
        case (length <= 162):
            return [281, length - 131, 5];
        case (length <= 194):
            return [282, length - 163, 5];
        case (length <= 226):
            return [283, length - 195, 5];
        case (length <= 257):
            return [284, length - 227, 5];
        case (length === 258):
            return [285, length - 258, 0];
    }
};

/**
 * Generate the length code table.
 * @returns {Array} The length code table.
 */
const generateLengthTable = () => {
    if (!lengthCodeTable) {
        lengthCodeTable = [];
        for (let i = 3; i <= 258; i++) {
            const c = generateLengthCodes(i);
            lengthCodeTable[i] = (c[2] << 24) | (c[1] << 16) | c[0];
        }
    }

    return lengthCodeTable;
};

/**
 * Get the distance code.
 * @param {number} dist The distance.
 * @returns {Array} The distance code.
 */
const getDistanceCode = (dist) => {
    switch (true) {
        case (dist === 1):
            return [0, dist - 1, 0];
        case (dist === 2):
            return [1, dist - 2, 0];
        case (dist === 3):
            return [2, dist - 3, 0];
        case (dist === 4):
            return [3, dist - 4, 0];
        case (dist <= 6):
            return [4, dist - 5, 1];
        case (dist <= 8):
            return [5, dist - 7, 1];
        case (dist <= 12):
            return [6, dist - 9, 2];
        case (dist <= 16):
            return [7, dist - 13, 2];
        case (dist <= 24):
            return [8, dist - 17, 3];
        case (dist <= 32):
            return [9, dist - 25, 3];
        case (dist <= 48):
            return [10, dist - 33, 4];
        case (dist <= 64):
            return [11, dist - 49, 4];
        case (dist <= 96):
            return [12, dist - 65, 5];
        case (dist <= 128):
            return [13, dist - 97, 5];
        case (dist <= 192):
            return [14, dist - 129, 6];
        case (dist <= 256):
            return [15, dist - 193, 6];
        case (dist <= 384):
            return [16, dist - 257, 7];
        case (dist <= 512):
            return [17, dist - 385, 7];
        case (dist <= 768):
            return [18, dist - 513, 8];
        case (dist <= 1024):
            return [19, dist - 769, 8];
        case (dist <= 1536):
            return [20, dist - 1025, 9];
        case (dist <= 2048):
            return [21, dist - 1537, 9];
        case (dist <= 3072):
            return [22, dist - 2049, 10];
        case (dist <= 4096):
            return [23, dist - 3073, 10];
        case (dist <= 6144):
            return [24, dist - 4097, 11];
        case (dist <= 8192):
            return [25, dist - 6145, 11];
        case (dist <= 12288):
            return [26, dist - 8193, 12];
        case (dist <= 16384):
            return [27, dist - 12289, 12];
        case (dist <= 24576):
            return [28, dist - 16385, 13];
        case (dist <= 32768):
            return [29, dist - 24577, 13];
    }
};

/**
 * Get the length code.
 * @param {number} length The length.
 * @returns {number} The length code.
 */
const getLengthCode = (length) => {
    return generateLengthTable()[length];
};

/**
 * Lz77Match Class
 * Based on https://github.com/imaya/zlib.js/blob/develop/src/rawdeflate.js
 * @class
 */
export default class Lz77Match {
    #backwardDistance;
    #length;

    /**
     * New Lz77Match constructor.
     * @param {number} length The length of the match.
     * @param {number} backwardDistance The distanch to match position.
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
     * Get the LZ77 coded array.
     * @returns {Array} The LZ77 Array.
     */
    toLz77Array() {
        const codeArray = [];
        let pos = 0;

        const lengthCode = getLengthCode(this.#length);
        codeArray[pos++] = lengthCode & 0xffff;
        codeArray[pos++] = (lengthCode >> 16) & 0xff;
        codeArray[pos++] = lengthCode >> 24;

        const distCode = getDistanceCode(this.#backwardDistance);
        codeArray[pos++] = distCode[0];
        codeArray[pos++] = distCode[1];
        codeArray[pos] = distCode[2];

        return codeArray;
    }
}
