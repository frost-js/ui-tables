import CRC32 from './crc32.js';
import RawDeflate from './raw-deflate.js';

const encoder = new TextEncoder();

/**
 * Encode a string in binary.
 * @param {string} string The string.
 * @returns {Uint8Array} The encoded string.
 */
const encode = (string) => {
    return encoder.encode(string);
};

/**
 * Gets the byte length of a string.
 * @param {string} string The string.
 * @returns {number} The byte length.
 */
const length = (string) => {
    return encode(string).length;
};

/**
 * Encodes an unsigned 16-bit integer in little-endian byte order.
 * @param {number} number The number.
 * @returns {Uint8Array} The encoded bytes.
 */
const signed16 = (number) => {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, number, true);
    return bytes;
};

/**
 * Encodes an unsigned 32-bit integer in little-endian byte order.
 * @param {number} number The number.
 * @returns {Uint8Array} The encoded bytes.
 */
const signed32 = (number) => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, number, true);
    return bytes;
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
     * Creates a Zip.
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
     * Adds a file to the Zip.
     * @param {string} filename The filename.
     * @param {string} data The data.
     */
    addFile(filename, data) {
        const vNeeded = 20;

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

        const now = new Date();

        const year = Math.min(2107, Math.max(1980, now.getFullYear()));
        const modTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
        const modDate = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

        const dir = [
            encode('\x50\x4b\x01\x02'), // dir signature
            signed16(0), // version made by
            signed16(vNeeded),
            signed16(0x0800), // UTF-8 filenames
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
            signed16(0x0800), // UTF-8 filenames
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
     * Creates the zip file.
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
