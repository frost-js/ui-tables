import BitStream from './bit-stream.js';
import Heap from './heap.js';
import Lz77Match from './lz77-match.js';

/**
 * Gets the Huffman codes from the code lengths.
 * @param {Uint8Array} lengths The code lengths.
 * @returns {Uint16Array} The Huffman codes.
 */
const getCodesFromLengths = (lengths) => {
    const codes = new Uint16Array(lengths.length);
    const count = [];
    const startCode = [];
    let code = 0;

    for (let i = 0; i < lengths.length; i++) {
        count[lengths[i]] = (count[lengths[i]] | 0) + 1;
    }

    for (let i = 1; i <= 16; i++) {
        startCode[i] = code;
        code += count[i] | 0;
        code <<= 1;
    }

    for (let i = 0; i < lengths.length; i++) {
        code = startCode[lengths[i]];
        startCode[lengths[i]] += 1;
        codes[i] = 0;

        for (let j = 0; j < lengths[i]; j++) {
            codes[i] = (codes[i] << 1) | (code & 1);
            code >>>= 1;
        }
    }

    return codes;
};

/**
 * Gets the lengths of a Huffman code.
 * @param {Uint32Array} freqs The frequency counts.
 * @param {number} limit The code length limit.
 * @returns {Uint8Array} The code lengths.
 */
const getLengths = (freqs, limit) => {
    const heap = new Heap(2 * 286);
    const length = new Uint8Array(freqs.length);

    for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] > 0) {
            heap.push(i, freqs[i]);
        }
    }

    const nodes = new Array(heap.length / 2);
    const values = new Uint32Array(heap.length / 2);

    if (nodes.length === 1) {
        length[heap.pop().index] = 1;
        return length;
    }

    for (let i = 0; i < nodes.length; i++) {
        nodes[i] = heap.pop();
        values[i] = nodes[i].value;
    }

    const codeLengths = reversePackageMerge(values, values.length, limit);

    for (let i = 0; i < nodes.length; i++) {
        length[nodes[i].index] = codeLengths[i];
    }

    return length;
};

/**
 * Calculates the tree symbols.
 * @param {number} hLit The HLIT.
 * @param {Uint8Array} litLenLengths The literal lengths and length codes.
 * @param {number} hDist The HDIST.
 * @param {Uint8Array} distLengths The distance code lengths.
 * @returns {object} The tree symbols.
 */
const getTreeSymbols = (hLit, litLenLengths, hDist, distLengths) => {
    const src = new Uint32Array(hLit + hDist);
    const result = new Uint32Array(316);
    const freqs = new Uint8Array(19);

    let j = 0;

    for (let i = 0; i < hLit; i++) {
        src[j++] = litLenLengths[i];
    }

    for (let i = 0; i < hDist; i++) {
        src[j++] = distLengths[i];
    }

    let nResult = 0;

    for (let i = 0; i < src.length; i += j) {
        for (j = 1; i + j < src.length && src[i + j] === src[i]; j++) {
            // Count consecutive symbols without emitting values.
        }

        let runLength = j;

        if (src[i] === 0) {
            if (runLength < 3) {
                while (runLength-- > 0) {
                    result[nResult++] = 0;
                    freqs[0]++;
                }
            } else {
                while (runLength > 0) {
                    let rpt = Math.min(runLength, 138);

                    if (rpt > runLength - 3 && rpt < runLength) {
                        rpt = runLength - 3;
                    }

                    if (rpt <= 10) {
                        result[nResult++] = 17;
                        result[nResult++] = rpt - 3;
                        freqs[17]++;
                    } else {
                        result[nResult++] = 18;
                        result[nResult++] = rpt - 11;
                        freqs[18]++;
                    }

                    runLength -= rpt;
                }
            }
        } else {
            result[nResult++] = src[i];
            freqs[src[i]]++;
            runLength--;

            if (runLength < 3) {
                while (runLength-- > 0) {
                    result[nResult++] = src[i];
                    freqs[src[i]]++;
                }
            } else {
                while (runLength > 0) {
                    let rpt = Math.min(runLength, 6);

                    if (rpt > runLength - 3 && rpt < runLength) {
                        rpt = runLength - 3;
                    }

                    result[nResult++] = 16;
                    result[nResult++] = rpt - 3;
                    freqs[16]++;

                    runLength -= rpt;
                }
            }
        }
    }

    return {
        codes: result.subarray(0, nResult),
        freqs,
    };
};

/**
 * Finds the optimal Huffman code.
 * @param {Uint32Array} freqs The value frequencies.
 * @param {number} symbols The number of symbols.
 * @param {number} limit The code length limit.
 * @returns {Uint8Array} The code lengths.
 */
const reversePackageMerge = (freqs, symbols, limit) => {
    const minimumCost = new Uint16Array(limit);
    const flag = new Uint8Array(limit);
    const codeLengths = new Uint8Array(symbols);
    const value = new Array(limit);
    const type = new Array(limit);
    const currentPosition = new Array(limit);
    let excess = (1 << limit) - symbols;
    const half = (1 << (limit - 1));

    minimumCost[limit - 1] = symbols;

    for (let i = 0; i < limit; i++) {
        if (excess < half) {
            flag[i] = 0;
        } else {
            flag[i] = 1;
            excess -= half;
        }
        excess <<= 1;
        minimumCost[limit - 2 - i] = (minimumCost[limit - 1 - i] / 2 | 0) + symbols;
    }

    minimumCost[0] = flag[0];

    value[0] = new Array(minimumCost[0]);
    type[0] = new Array(minimumCost[0]);

    for (let i = 0; i < limit; i++) {
        if (minimumCost[i] > 2 * minimumCost[i - 1] + flag[i]) {
            minimumCost[i] = 2 * minimumCost[i - 1] + flag[i];
        }

        value[i] = new Array(minimumCost[i]);
        type[i] = new Array(minimumCost[i]);
    }

    for (let i = 0; i < symbols; i++) {
        codeLengths[i] = limit;
    }

    for (let i = 0; i < minimumCost[limit - 1]; i++) {
        value[limit - 1][i] = freqs[i];
        type[limit - 1][i] = i;
    }

    for (let i = 0; i < limit; i++) {
        currentPosition[i] = 0;
    }

    if (flag[limit - 1] === 1) {
        codeLengths[0]--;
        currentPosition[limit - 1]++;
    }

    const takePackage = (i) => {
        const x = type[i][currentPosition[i]];

        if (x === symbols) {
            takePackage(i + 1);
            takePackage(i + 1);
        } else {
            codeLengths[x]--;
        }

        currentPosition[i]++;
    };

    for (let i = limit - 2; i >= 0; i--) {
        let t = 0;
        let next = currentPosition[i + 1];

        for (let j = 0; j < minimumCost[i]; j++) {
            const weight = value[i + 1][next] + value[i + 1][next + 1];

            if (weight > freqs[t]) {
                value[i][j] = weight;
                type[i][j] = symbols;
                next += 2;
            } else {
                value[i][j] = freqs[t];
                type[i][j] = t;
                t++;
            }
        }

        currentPosition[i] = 0;
        if (flag[i] === 1) {
            takePackage(i);
        }
    }

    return codeLengths;
};

/**
 * RawDeflate Class
 * Based on https://github.com/imaya/zlib.js/blob/develop/src/rawdeflate.js
 * @class
 */
export default class RawDeflate {
    #freqsDist;
    #freqsLitLen;
    #input;
    #lazy;
    #lz77MaxLength;
    #lz77MinLength;
    #output;
    #outputIndex;

    /**
     * Compresses the data.
     * @param {Uint8Array} data The input data.
     * @param {object} options The options to create the RawDeflate with.
     * @returns {Uint8Array} The compressed data.
     */
    static compress(data, options) {
        return (new this(data, options)).compress();
    }

    /**
     * Creates a RawDeflate.
     * @param {Uint8Array} input The input data.
     * @param {object} options The options to create the RawDeflate with.
     */
    constructor(input, options) {
        options = {
            lazy: 0,
            lz77MinLength: 3,
            lz77MaxLength: 258,
            ...options,
        };

        this.#input = input;
        this.#lazy = options.lazy;
        this.#lz77MinLength = options.lz77MinLength;
        this.#lz77MaxLength = options.lz77MaxLength;
        this.#outputIndex = 0;
        this.#output = new Uint8Array(0x8000);
    }

    /**
     * Compresses the data.
     * @returns {Uint8Array} The compressed data.
     */
    compress() {
        const stream = new BitStream(new Uint8Array(this.#output.buffer), this.#outputIndex);

        const bFinal = 1;
        const bType = 2;

        stream.writeBits(bFinal, 1, true);
        stream.writeBits(bType, 2, true);

        const data = this.#lz77();

        const litLenLengths = getLengths(this.#freqsLitLen, 15);
        const litLenCodes = getCodesFromLengths(litLenLengths);
        const distLengths = getLengths(this.#freqsDist, 7);
        const distCodes = getCodesFromLengths(distLengths);

        // hlit, hdist
        let hLit; let hDist;
        for (hLit = 286; hLit > 257 && litLenLengths[hLit - 1] === 0; hLit--) {
            // Count consecutive symbols without emitting values.
        }
        for (hDist = 30; hDist > 1 && distLengths[hDist - 1] === 0; hDist--) {
            // Count consecutive symbols without emitting values.
        }

        // hclen
        const treeSymbols = getTreeSymbols(hLit, litLenLengths, hDist, distLengths);
        const treeLengths = getLengths(treeSymbols.freqs, 7);

        const transLengths = new Array(19);
        const hcLengthOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        for (let i = 0; i < 19; i++) {
            transLengths[i] = treeLengths[hcLengthOrder[i]];
        }

        let hcLen;
        for (hcLen = 19; hcLen > 4 && transLengths[hcLen - 1] === 0; hcLen--) {
            // Count consecutive symbols without emitting values.
        }

        const treeCodes = getCodesFromLengths(treeLengths);

        stream.writeBits(hLit - 257, 5, true);
        stream.writeBits(hDist - 1, 5, true);
        stream.writeBits(hcLen - 4, 4, true);

        for (let i = 0; i < hcLen; i++) {
            stream.writeBits(transLengths[i], 3, true);
        }

        for (let i = 0; i < treeSymbols.codes.length; i++) {
            const code = treeSymbols.codes[i];

            stream.writeBits(treeCodes[code], treeLengths[code], true);

            if (code >= 16) {
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

        for (let i = 0; i < data.length; i++) {
            const literal = data[i];

            stream.writeBits(litLenCodes[literal], litLenLengths[literal], true);

            if (literal > 256) {
                stream.writeBits(data[++i], data[++i], true);
                const code = data[++i];
                stream.writeBits(distCodes[code], distLengths[code], true);
                stream.writeBits(data[++i], data[++i], true);
            } else if (literal === 256) {
                break;
            }
        }

        this.#output = stream.finish();
        this.#outputIndex = this.#output.length;

        return this.#output;
    }

    /**
     * Calculates the LZ77 array.
     * @returns {Uint16Array} The LZ77 array.
     */
    #lz77() {
        const lz77buf = new Uint16Array(this.#input.length * 2);
        const freqsLitLen = new Uint32Array(286);
        const freqsDist = new Uint32Array(30);

        freqsLitLen[256] = 1;

        const table = {};
        let pos = 0;
        let skipLength = 0;
        let prevMatch;

        const writeMatch = (match, offset) => {
            const tempArray = match.toLz77Array();

            for (let i = 0; i < tempArray.length; i++) {
                lz77buf[pos++] = tempArray[i];
            }

            freqsLitLen[tempArray[0]]++;
            freqsDist[tempArray[3]]++;

            skipLength = match.length + offset - 1;
            prevMatch = null;
        };

        for (let position = 0; position < this.#input.length; position++) {
            let matchKey = 0;
            for (let i = 0; i < this.#lz77MinLength; i++) {
                if (position + i === this.#input.length) {
                    break;
                }

                matchKey = (matchKey << 8) | this.#input[position + i];
            }

            if (!(matchKey in table)) {
                table[matchKey] = [];
            }

            const matchList = table[matchKey];

            if (skipLength-- > 0) {
                matchList.push(position);
                continue;
            }

            while (matchList.length > 0 && position - matchList[0] > 0x8000) {
                matchList.shift();
            }

            if (position + this.#lz77MinLength >= this.#input.length) {
                if (prevMatch) {
                    writeMatch(prevMatch, -1);
                }

                for (let i = 0; i < this.#input.length - position; i++) {
                    const tmp = this.#input[position + i];
                    lz77buf[pos++] = tmp;
                    freqsLitLen[tmp]++;
                }
                break;
            }

            if (matchList.length) {
                const longestMatch = this.#searchLongestMatch(position, matchList);

                if (prevMatch) {
                    if (prevMatch.length < longestMatch.length) {
                        const tmp = this.#input[position - 1];
                        lz77buf[pos++] = tmp;
                        freqsLitLen[tmp]++;

                        writeMatch(longestMatch, 0);
                    } else {
                        writeMatch(prevMatch, -1);
                    }
                } else if (longestMatch.length < this.#lazy) {
                    prevMatch = longestMatch;
                } else {
                    writeMatch(longestMatch, 0);
                }
            } else if (prevMatch) {
                writeMatch(prevMatch, -1);
            } else {
                const tmp = this.#input[position];
                lz77buf[pos++] = tmp;
                freqsLitLen[tmp]++;
            }

            matchList.push(position);
        }

        lz77buf[pos++] = 256;
        freqsLitLen[256]++;
        this.#freqsLitLen = freqsLitLen;
        this.#freqsDist = freqsDist;

        return lz77buf.subarray(0, pos);
    }

    /**
     * Finds the longest match from the list of matches.
     * @param {number} position The array position.
     * @param {Array} matchList The list of matches.
     * @returns {Lz77Match} The Lz77Match.
     */
    #searchLongestMatch(position, matchList) {
        let currentMatch;
        let matchMax = 0;
        const length = matchList.length;

        permatch:
        for (let i = 0; i < length; i++) {
            const match = matchList[length - i - 1];
            let matchLength = this.#lz77MinLength;

            if (matchMax > this.#lz77MinLength) {
                for (let j = matchMax; j > this.#lz77MinLength; j--) {
                    if (this.#input[match + j - 1] !== this.#input[position + j - 1]) {
                        continue permatch;
                    }
                }

                matchLength = matchMax;
            }

            while (matchLength < this.#lz77MaxLength && position + matchLength < this.#input.length && this.#input[match + matchLength] === this.#input[position + matchLength]) {
                matchLength++;
            }

            if (matchLength > matchMax) {
                currentMatch = match;
                matchMax = matchLength;
            }

            if (matchLength === this.#lz77MaxLength) {
                break;
            }
        }

        return new Lz77Match(matchMax, position - currentMatch);
    }
}
