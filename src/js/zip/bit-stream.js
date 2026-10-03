let reverseTable = null;

/**
 * Generate the reverse table.
 * @returns {Uint8Array} The reverse table.
 */
const buildReverseTable = () => {
    if (reverseTable === null) {
        reverseTable = new Uint8Array(256);

        for (let i = 0; i < 256; ++i) {
            let n = i;
            let r = n;
            let s = 7;
            for (n >>>= 1; n; n >>>= 1) {
                r <<= 1;
                r |= n & 1;
                --s;
            }

            reverseTable[i] = (r << s & 0xff) >>> 0;
        }
    }

    return reverseTable;
};

/**
 * Reverse the bit order.
 * @param {number} n The number to reverse.
 * @returns {number} The reversed number.
 */
const rev = (n) => {
    return buildReverseTable()[n];
};

/**
 * Reverse the bit order (32-bit).
 * @param {number} n The number to reverse.
 * @returns {number} The reversed number.
 */
const rev32 = (n) => {
    const reverseTable = buildReverseTable();

    return (reverseTable[n & 0xff] << 24) |
        (reverseTable[n >>> 8 & 0xff] << 16) |
        (reverseTable[n >>> 16 & 0xff] << 8) |
        reverseTable[n >>> 24 & 0xff];
};

/**
 * BitStream Class
 * Based on https://github.com/imaya/zlib.js/blob/develop/src/bitstream.js
 * @class
 */
export default class BitStream {
    #bitIndex;
    #buffer;
    #index;

    /**
     * Creates a BitStream.
     * @param {Uint8Array} buffer The buffer to write to.
     * @param {number} [index] The index to start writing at.
     */
    constructor(buffer, index = 0) {
        this.#buffer = buffer;
        this.#index = index;
        this.#bitIndex = 0;

        if (this.#buffer.length <= this.#index) {
            this.#expandBuffer();
        }
    }

    /**
     * Finish writing and return the buffer.
     * @returns {Uint8Array} The buffer.
     */
    finish() {
        let index = this.#index;

        if (this.#bitIndex > 0) {
            this.#buffer[index] <<= 8 - this.#bitIndex;
            this.#buffer[index] = rev(this.#buffer[index]);
            index++;
        }

        return this.#buffer.subarray(0, index);
    }

    /**
     * Writes bits to the buffer.
     * @param {number} number The number to write.
     * @param {number} n The number of bits to write.
     * @param {number} [reverse] Whether to write in reverse order.
     */
    writeBits(number, n, reverse) {
        if (reverse && n > 1) {
            number = n > 8 ?
                rev32(number) >> (32 - n) :
                rev(number) >> (8 - n);
        }

        let current = this.#buffer[this.#index];

        if (n + this.#bitIndex < 8) {
            current = (current << n) | number;
            this.#bitIndex += n;
        } else {
            for (let i = 0; i < n; i++) {
                current = (current << 1) | ((number >> n - i - 1) & 1);

                if (++this.#bitIndex === 8) {
                    this.#bitIndex = 0;
                    this.#buffer[this.#index++] = rev(current);
                    current = 0;

                    if (this.#index === this.#buffer.length) {
                        this.#expandBuffer();
                    }
                }
            }
        }

        this.#buffer[this.#index] = current;
    }

    /**
     * Expand the buffer size.
     */
    #expandBuffer() {
        const oldBuffer = this.#buffer;
        const oldLength = oldBuffer.length;

        this.#buffer = new Uint8Array(oldLength << 1);
        this.#buffer.set(oldBuffer);
    }
}
