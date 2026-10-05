import BitStream from './bit-stream.js';
import { getCodeLengths, getCodesFromLengths, getTreeSymbols } from './huffman.js';
import Lz77Match from './lz77-match.js';

/**
 * @typedef {object} RawDeflateOptions
 * @property {number} [lazy=0] Defers shorter matches to compare the next byte's match; zero disables deferral.
 * @property {number} [lz77MinLength=3] The minimum match length.
 * @property {number} [lz77MaxLength=258] The maximum match length.
 */

/**
 * Compresses bytes into a DEFLATE block with dynamic Huffman codes.
 * Adapted from https://github.com/imaya/zlib.js/blob/develop/src/rawdeflate.js
 */
export default class RawDeflate {
    #distanceFrequencies;
    #input;
    #lazyThreshold;
    #literalFrequencies;
    #maxMatchLength;
    #minMatchLength;
    #output;
    #outputIndex;

    /**
     * Compresses the data.
     * @param {Uint8Array} data The input data.
     * @param {RawDeflateOptions} [options] The compression options.
     * @returns {Uint8Array} The compressed data.
     */
    static compress(data, options) {
        return (new this(data, options)).compress();
    }

    /**
     * Creates a RawDeflate.
     * @param {Uint8Array} input The input data.
     * @param {RawDeflateOptions} [options] The compression options.
     */
    constructor(input, options) {
        options = {
            lazy: 0,
            lz77MinLength: 3,
            lz77MaxLength: 258,
            ...options,
        };

        this.#input = input;
        this.#lazyThreshold = options.lazy;
        this.#minMatchLength = options.lz77MinLength;
        this.#maxMatchLength = options.lz77MaxLength;
        this.#outputIndex = 0;
        this.#output = new Uint8Array(0x8000);
    }

    /**
     * Compresses the data.
     * @returns {Uint8Array} The compressed data.
     */
    compress() {
        const stream = new BitStream(new Uint8Array(this.#output.buffer), this.#outputIndex);

        // Emit one final block using dynamic Huffman trees (BFINAL=1, BTYPE=2).
        const finalBlock = 1;
        const blockType = 2;

        stream.writeBits(finalBlock, 1, true);
        stream.writeBits(blockType, 2, true);

        const tokens = this.#getLz77Tokens();

        const literalCodeLengths = getCodeLengths(this.#literalFrequencies, 15);
        const literalCodes = getCodesFromLengths(literalCodeLengths);
        const distanceCodeLengths = getCodeLengths(this.#distanceFrequencies, 7);
        const distanceCodes = getCodesFromLengths(distanceCodeLengths);

        // Omit unused trailing symbols when writing the HLIT and HDIST counts.
        let literalCount = 286;
        let distanceCount = 30;

        while (literalCount > 257 && literalCodeLengths[literalCount - 1] === 0) {
            literalCount--;
        }

        while (distanceCount > 1 && distanceCodeLengths[distanceCount - 1] === 0) {
            distanceCount--;
        }

        // The Huffman trees are themselves encoded using a code-length tree.
        const treeSymbols = getTreeSymbols(literalCount, literalCodeLengths, distanceCount, distanceCodeLengths);
        const treeLengths = getCodeLengths(treeSymbols.frequencies, 7);

        // DEFLATE prescribes this order for the code-length alphabet.
        const codeLengthOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const orderedCodeLengths = codeLengthOrder.map((code) => treeLengths[code]);

        let codeLengthCount = 19;

        while (codeLengthCount > 4 && orderedCodeLengths[codeLengthCount - 1] === 0) {
            codeLengthCount--;
        }

        const treeCodes = getCodesFromLengths(treeLengths);

        stream.writeBits(literalCount - 257, 5, true);
        stream.writeBits(distanceCount - 1, 5, true);
        stream.writeBits(codeLengthCount - 4, 4, true);

        for (let i = 0; i < codeLengthCount; i++) {
            stream.writeBits(orderedCodeLengths[i], 3, true);
        }

        for (let i = 0; i < treeSymbols.codes.length; i++) {
            const code = treeSymbols.codes[i];

            stream.writeBits(treeCodes[code], treeLengths[code], true);

            if (code >= 16) {
                // Repeat symbols carry an extra value after the Huffman symbol.
                i++;

                let bitLength;

                switch (code) {
                    case 16:
                        bitLength = 2;
                        break;
                    case 17:
                        bitLength = 3;
                        break;
                    case 18:
                        bitLength = 7;
                        break;
                }

                stream.writeBits(treeSymbols.codes[i], bitLength, true);
            }
        }

        for (let i = 0; i < tokens.length; i++) {
            const literal = tokens[i];

            stream.writeBits(literalCodes[literal], literalCodeLengths[literal], true);

            if (literal > 256) {
                const lengthExtra = tokens[++i];
                const lengthBitCount = tokens[++i];
                const distanceCode = tokens[++i];
                const distanceExtra = tokens[++i];
                const distanceBitCount = tokens[++i];

                stream.writeBits(lengthExtra, lengthBitCount, true);
                stream.writeBits(distanceCodes[distanceCode], distanceCodeLengths[distanceCode], true);
                stream.writeBits(distanceExtra, distanceBitCount, true);
            } else if (literal === 256) {
                break;
            }
        }

        this.#output = stream.finish();
        this.#outputIndex = this.#output.length;

        return this.#output;
    }

    /**
     * Finds the longest match from the list of matches.
     * @param {number} position The array position.
     * @param {number[]} matchList The earlier positions with the same prefix.
     * @returns {Lz77Match} The longest match.
     */
    #findLongestMatch(position, matchList) {
        let matchPosition;
        let longestLength = 0;
        const length = matchList.length;

        // Check recent candidates first and reject any that cannot improve the longest match.
        candidate:
        for (let i = 0; i < length; i++) {
            const match = matchList[length - i - 1];
            let matchLength = this.#minMatchLength;

            if (longestLength > this.#minMatchLength) {
                for (let j = longestLength; j > this.#minMatchLength; j--) {
                    if (this.#input[match + j - 1] !== this.#input[position + j - 1]) {
                        continue candidate;
                    }
                }

                matchLength = longestLength;
            }

            while (
                matchLength < this.#maxMatchLength &&
                position + matchLength < this.#input.length &&
                this.#input[match + matchLength] === this.#input[position + matchLength]
            ) {
                matchLength++;
            }

            if (matchLength > longestLength) {
                matchPosition = match;
                longestLength = matchLength;
            }

            if (matchLength === this.#maxMatchLength) {
                break;
            }
        }

        return new Lz77Match(longestLength, position - matchPosition);
    }

    /**
     * Builds literal and match tokens while counting their Huffman symbol frequencies.
     * @returns {Uint16Array} The literal and match tokens.
     */
    #getLz77Tokens() {
        const tokens = new Uint16Array(this.#input.length * 2);
        const literalFrequencies = new Uint32Array(286);
        const distanceFrequencies = new Uint32Array(30);

        literalFrequencies[256] = 1;

        const matchesByKey = {};
        let tokenIndex = 0;
        let skipLength = 0;
        let previousMatch;

        // Emitting a match advances the input scan and updates both symbol frequency tables.
        const writeMatch = (match, offset) => {
            const matchTokens = match.toLz77Array();

            for (let i = 0; i < matchTokens.length; i++) {
                tokens[tokenIndex++] = matchTokens[i];
            }

            literalFrequencies[matchTokens[0]]++;
            distanceFrequencies[matchTokens[3]]++;

            skipLength = match.length + offset - 1;
            previousMatch = null;
        };

        for (let position = 0; position < this.#input.length; position++) {
            let matchKey = 0;

            for (let i = 0; i < this.#minMatchLength; i++) {
                if (position + i === this.#input.length) {
                    break;
                }

                matchKey = (matchKey << 8) | this.#input[position + i];
            }

            if (!(matchKey in matchesByKey)) {
                matchesByKey[matchKey] = [];
            }

            const matchList = matchesByKey[matchKey];

            if (skipLength-- > 0) {
                matchList.push(position);
                continue;
            }

            // DEFLATE matches may refer back at most 32 KiB.
            while (matchList.length > 0 && position - matchList[0] > 0x8000) {
                matchList.shift();
            }

            if (position + this.#minMatchLength >= this.#input.length) {
                if (previousMatch) {
                    writeMatch(previousMatch, -1);
                }

                for (let i = 0; i < this.#input.length - position; i++) {
                    const literal = this.#input[position + i];
                    tokens[tokenIndex++] = literal;
                    literalFrequencies[literal]++;
                }

                break;
            }

            if (matchList.length) {
                const longestMatch = this.#findLongestMatch(position, matchList);

                if (previousMatch) {
                    if (previousMatch.length < longestMatch.length) {
                        const literal = this.#input[position - 1];
                        tokens[tokenIndex++] = literal;
                        literalFrequencies[literal]++;

                        writeMatch(longestMatch, 0);
                    } else {
                        writeMatch(previousMatch, -1);
                    }
                } else if (longestMatch.length < this.#lazyThreshold) {
                    // Defer short matches so the next byte can offer a longer match.
                    previousMatch = longestMatch;
                } else {
                    writeMatch(longestMatch, 0);
                }
            } else if (previousMatch) {
                writeMatch(previousMatch, -1);
            } else {
                const literal = this.#input[position];
                tokens[tokenIndex++] = literal;
                literalFrequencies[literal]++;
            }

            matchList.push(position);
        }

        tokens[tokenIndex++] = 256;
        literalFrequencies[256]++;
        this.#literalFrequencies = literalFrequencies;
        this.#distanceFrequencies = distanceFrequencies;

        return tokens.subarray(0, tokenIndex);
    }
}
