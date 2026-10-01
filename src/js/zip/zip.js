import CRC32 from './crc32.js';
import RawDeflate from './raw-deflate.js';

const encoder = new TextEncoder;

/**
 * Encode a string in binary.
 * @param {string} string The string.
 * @returns {Uint8Array} The encoded string.
 */
const encode = (string) => {
    return encoder.encode(string);
};

/**
 * Get the byte length of a string.
 * @param {string} string The string.
 * @returns {number} The byte length.
 */
const length = (string) => {
    return encode(string).length;
};

/**
 * Convert a number to an Int16Array.
 * @param {number} number The number.
 * @returns {Int16Array} The Int16Array.
 */
const signed16 = (number) => {
    return new Int16Array([number]);
};

/**
 * Convert a number to an Int32Array.
 * @param {number} number The number.
 * @returns {Int32Array} The Int32Array.
 */
const signed32 = (number) => {
    return new Int32Array([number]);
};

/**
 * Zip Class
 * Based on https://github.com/shuchkin/simplexlsxgen/blob/master/src/SimpleXLSXGen.php
 * @class
 */
export default class Zip {
    #dir;
    #entries;
    #files;
    #offset;
    #type;

    /**
     * New Zip constructor.
     * @param {string} [type=octet/stream] The file type.
     */
    constructor(type = 'octet/stream') {
        this.#type = type;
        this.#dir = [];
        this.#files = [];
        this.#offset = 0;
        this.#entries = 0;
    }

    /**
     * Add a file to the Zip.
     * @param {string} filename The filename.
     * @param {string} data The data.
     */
    addFile(filename, data) {
        const vNeeded = 10;

        const filenameLength = length(filename);

        data = encode(data);
        const uncompressedSize = data.byteLength;

        const crc32 = CRC32.calc(data);

        let compressedSize = uncompressedSize;
        let cMethod = 0;

        if (uncompressedSize >= 256) {
            data = RawDeflate.compress(data);
            compressedSize = data.byteLength;
            cMethod = 8;
        }

        const now = new Date;

        let offsetSeconds = now.getSeconds();
        if (offsetSeconds >= 32) {
            offsetSeconds -= 32;
        }

        const offsetYear = now.getYear() - 1980;

        const seconds = `${offsetSeconds.toString(2)}`.padStart(5, '0');
        const minutes = `${now.getMinutes().toString(2)}`.padStart(6, '0');
        const hours = `${now.getHours().toString(2)}`.padStart(5, '0');
        const date = `${now.getDate().toString(2)}`.padStart(5, '0');
        const month = `${now.getMonth().toString(2)}`.padStart(4, '0');
        const year = `${offsetYear.toString(2)}`.padStart(7, '0');

        const modTime = parseInt(`${hours}${minutes}${seconds}`, 2);
        const modDate = parseInt(`${year}${month}${date}`, 2);

        const dir = [
            encode('\x50\x4b\x01\x02'), // dir signature
            signed16(0), // version made by
            signed16(vNeeded),
            signed16(0), // bit flag
            signed16(cMethod),
            signed16(modTime),
            signed16(modDate),
            signed32(crc32),
            signed32(compressedSize),
            signed32(uncompressedSize),
            signed16(filenameLength),
            signed16(0), // extra field length
            signed16(0), // file comment length
            signed16(0), // disk number start
            signed16(0), // internal file attributes
            signed32(32), // internal file attributes
            signed32(this.#offset), // offset of local header
            encode(filename),
        ];

        this.#dir.push(...dir);

        const file = [
            encode('\x50\x4b\x03\x04'), // zip signature
            signed16(vNeeded),
            signed16(0), // bit flag
            signed16(cMethod),
            signed16(modTime),
            signed16(modDate),
            signed32(crc32),
            signed32(compressedSize),
            signed32(uncompressedSize),
            signed16(filenameLength),
            signed16(0), // extra field length
            encode(filename),
            data,
        ];

        this.#files.push(...file);

        this.#offset += file.reduce((acc, file) => acc + file.byteLength, 0);
        this.#entries++;
    }

    /**
     * Create the zip file.
     * @returns {Blob} The zip file.
     */
    zip() {
        const dirLength = this.#dir.reduce((acc, file) => acc + file.byteLength, 0);

        return new Blob(
            [
                ...this.#files,
                ...this.#dir,
                encode('\x50\x4b\x05\x06'), // end of central directory
                signed16(0), // number of this disk
                signed16(0), // number of the disk with the start of the central directory
                signed16(this.#entries), // total entries on this disk
                signed16(this.#entries), // total entries
                signed32(dirLength), // size of central dir
                signed32(this.#offset), // offset to start of central dir
                signed16(0), // file comment length
            ],
            { type: this.#type },
        );
    }
}
