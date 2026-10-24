import CRC32 from './crc32.js';
import { byteLength, encode, encodeUint16, encodeUint32 } from './helpers.js';
import RawDeflate from './raw-deflate.js';

/**
 * Builds ZIP archives from UTF-8 files.
 * Adapted from https://github.com/shuchkin/simplexlsxgen/blob/master/src/SimpleXLSXGen.php
 */
export default class Zip {
    #directory = [];
    #entries = 0;
    #files = [];
    #offset = 0;
    #type;

    /**
     * Creates a Zip.
     * @param {string} [type=octet/stream] The file type.
     */
    constructor(type = 'octet/stream') {
        this.#type = type;
    }

    /**
     * Adds a file to the Zip.
     * @param {string} filename The filename.
     * @param {string} data The data.
     */
    addFile(filename, data) {
        const versionNeeded = 20;

        const filenameLength = byteLength(filename);

        data = encode(data);

        const uncompressedSize = data.byteLength;

        const crc32 = CRC32.calc(data);

        let compressedSize = uncompressedSize;
        let compressionMethod = 0;

        // Small entries are stored directly; larger entries use DEFLATE compression.
        if (uncompressedSize >= 256) {
            data = RawDeflate.compress(data);
            compressedSize = data.byteLength;
            compressionMethod = 8;
        }

        const now = new Date();

        const year = Math.min(2107, Math.max(1980, now.getFullYear()));
        // ZIP stores dates as DOS bit fields, with years from 1980 and two-second precision.
        const modifiedTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
        const modifiedDate = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

        // The central directory indexes each entry by its local header offset.
        const directory = [
            encode('\x50\x4b\x01\x02'), // dir signature
            encodeUint16(0), // version made by
            encodeUint16(versionNeeded),
            encodeUint16(0x0800), // UTF-8 filenames
            encodeUint16(compressionMethod),
            encodeUint16(modifiedTime),
            encodeUint16(modifiedDate),
            encodeUint32(crc32),
            encodeUint32(compressedSize),
            encodeUint32(uncompressedSize),
            encodeUint16(filenameLength),
            encodeUint16(0), // extra field length
            encodeUint16(0), // file comment length
            encodeUint16(0), // disk number start
            encodeUint16(0), // internal file attributes
            encodeUint32(32), // external file attributes
            encodeUint32(this.#offset), // offset of local header
            encode(filename),
        ];

        this.#directory.push(...directory);

        const file = [
            encode('\x50\x4b\x03\x04'), // zip signature
            encodeUint16(versionNeeded),
            encodeUint16(0x0800), // UTF-8 filenames
            encodeUint16(compressionMethod),
            encodeUint16(modifiedTime),
            encodeUint16(modifiedDate),
            encodeUint32(crc32),
            encodeUint32(compressedSize),
            encodeUint32(uncompressedSize),
            encodeUint16(filenameLength),
            encodeUint16(0), // extra field length
            encode(filename),
            data,
        ];

        this.#files.push(...file);

        this.#offset += file.reduce((size, part) => size + part.byteLength, 0);
        this.#entries++;
    }

    /**
     * Creates the zip file.
     * @returns {Blob} The zip file.
     */
    zip() {
        const directoryLength = this.#directory.reduce((size, part) => size + part.byteLength, 0);

        return new Blob(
            [
                ...this.#files,
                ...this.#directory,
                encode('\x50\x4b\x05\x06'), // end of central directory
                encodeUint16(0), // number of this disk
                encodeUint16(0), // number of the disk with the start of the central directory
                encodeUint16(this.#entries), // total entries on this disk
                encodeUint16(this.#entries), // total entries
                encodeUint32(directoryLength), // size of central directory
                encodeUint32(this.#offset), // offset to start of central directory
                encodeUint16(0), // file comment length
            ],
            { type: this.#type },
        );
    }
}
