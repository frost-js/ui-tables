import { reverseByte, reverseUint32 } from './helpers.js';

/**
 * Writes the bit stream used by DEFLATE.
 * Adapted from https://github.com/imaya/zlib.js/blob/develop/src/bitstream.js
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
     * Finishes writing and returns the buffer.
     * @returns {Uint8Array} The buffer.
     */
    finish() {
        let index = this.#index;

        if (this.#bitIndex > 0) {
            this.#buffer[index] <<= 8 - this.#bitIndex;
            this.#buffer[index] = reverseByte(this.#buffer[index]);
            index++;
        }

        return this.#buffer.subarray(0, index);
    }

    /**
     * Writes bits to the buffer.
     * @param {number} number The number to write.
     * @param {number} bitCount The number of bits to write.
     * @param {boolean} [reverse] Whether to write in reverse order.
     */
    writeBits(number, bitCount, reverse) {
        if (reverse && bitCount > 1) {
            number = bitCount > 8 ?
                reverseUint32(number) >> (32 - bitCount) :
                reverseByte(number) >> (8 - bitCount);
        }

        let current = this.#buffer[this.#index];

        if (bitCount + this.#bitIndex < 8) {
            current = (current << bitCount) | number;
            this.#bitIndex += bitCount;
        } else {
            for (let i = 0; i < bitCount; i++) {
                current = (current << 1) | ((number >> bitCount - i - 1) & 1);

                if (++this.#bitIndex === 8) {
                    this.#bitIndex = 0;
                    // Bits accumulate from the left; completed bytes are stored least significant bit first.
                    this.#buffer[this.#index++] = reverseByte(current);
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
     * Expands the buffer size.
     */
    #expandBuffer() {
        const oldBuffer = this.#buffer;
        const oldLength = oldBuffer.length;

        this.#buffer = new Uint8Array(oldLength << 1);
        this.#buffer.set(oldBuffer);
    }
}
