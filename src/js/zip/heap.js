/**
 * Stores symbol frequencies in a max heap.
 * Adapted from https://github.com/imaya/zlib.js/blob/develop/src/heap.js
 */
export default class Heap {
    #buffer;
    #length;

    /**
     * Creates a Heap.
     * @param {number} [length] The size of the heap.
     */
    constructor(length) {
        // Each heap entry stores a frequency followed by its symbol index.
        this.#buffer = new Uint16Array(length * 2);
        this.#length = 0;
    }

    /**
     * Gets the current length.
     * @returns {number} The length.
     */
    get length() {
        return this.#length;
    }

    /**
     * Pops the top value off the heap.
     * @returns {object} The top value from the heap.
     */
    pop() {
        const value = this.#buffer[0];
        const index = this.#buffer[1];

        this.#length -= 2;
        this.#buffer[0] = this.#buffer[this.#length];
        this.#buffer[1] = this.#buffer[this.#length + 1];

        let parent = 0;

        while (true) {
            let current = 2 * parent + 2;

            if (current >= this.#length) {
                break;
            }

            if (current + 2 < this.#length && this.#buffer[current + 2] > this.#buffer[current]) {
                current += 2;
            }

            if (this.#buffer[current] > this.#buffer[parent]) {
                let swap = this.#buffer[parent];
                this.#buffer[parent] = this.#buffer[current];
                this.#buffer[current] = swap;

                swap = this.#buffer[parent + 1];
                this.#buffer[parent + 1] = this.#buffer[current + 1];
                this.#buffer[current + 1] = swap;
            } else {
                break;
            }

            parent = current;
        }

        return { index, value };
    }

    /**
     * Pushes a value onto the heap.
     * @param {number} index The index.
     * @param {number} value The value to push.
     */
    push(index, value) {
        let current = this.#length;
        this.#buffer[this.#length++] = value;
        this.#buffer[this.#length++] = index;

        while (current > 0) {
            // Parent and child offsets advance in pairs because each entry occupies two slots.
            const parent = ((current - 2) / 4 | 0) * 2;

            if (this.#buffer[current] > this.#buffer[parent]) {
                let swap = this.#buffer[current];
                this.#buffer[current] = this.#buffer[parent];
                this.#buffer[parent] = swap;

                swap = this.#buffer[current + 1];
                this.#buffer[current + 1] = this.#buffer[parent + 1];
                this.#buffer[parent + 1] = swap;

                current = parent;
            } else {
                break;
            }
        }
    }
}
