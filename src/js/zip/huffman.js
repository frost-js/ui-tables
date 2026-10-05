import Heap from './heap.js';

/**
 * Gets the Huffman codes from the code lengths.
 * @param {Uint8Array} lengths The code lengths.
 * @returns {Uint16Array} The Huffman codes.
 */
export function getCodesFromLengths(lengths) {
    const codes = new Uint16Array(lengths.length);
    const count = [];
    const startCode = [];
    let code = 0;

    for (let i = 0; i < lengths.length; i++) {
        count[lengths[i]] = (count[lengths[i]] | 0) + 1;
    }

    // Canonical Huffman codes are assigned consecutively within each bit length.
    for (let i = 1; i <= 16; i++) {
        startCode[i] = code;
        code += count[i] | 0;
        code <<= 1;
    }

    for (let i = 0; i < lengths.length; i++) {
        code = startCode[lengths[i]];
        startCode[lengths[i]] += 1;
        codes[i] = 0;

        // Reverse each assigned code for the bit-stream writer.
        for (let j = 0; j < lengths[i]; j++) {
            codes[i] = (codes[i] << 1) | (code & 1);
            code >>>= 1;
        }
    }

    return codes;
}

/**
 * Gets the lengths of a Huffman code.
 * @param {Uint32Array} frequencies The frequency counts.
 * @param {number} limit The code length limit.
 * @returns {Uint8Array} The code lengths.
 */
export function getCodeLengths(frequencies, limit) {
    const heap = new Heap(2 * 286);
    const length = new Uint8Array(frequencies.length);

    for (let i = 0; i < frequencies.length; i++) {
        if (frequencies[i] > 0) {
            heap.push(i, frequencies[i]);
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
}

/**
 * Encodes runs of code lengths for the dynamic Huffman tree header.
 * @param {number} literalCount The number of literal and length symbols.
 * @param {Uint8Array} literalCodeLengths The literal lengths and length codes.
 * @param {number} distanceCount The number of distance symbols.
 * @param {Uint8Array} distanceCodeLengths The distance code lengths.
 * @returns {{codes: Uint32Array, frequencies: Uint8Array}} The encoded symbols and their frequencies.
 */
export function getTreeSymbols(literalCount, literalCodeLengths, distanceCount, distanceCodeLengths) {
    const lengths = new Uint32Array(literalCount + distanceCount);
    const result = new Uint32Array(316);
    const frequencies = new Uint8Array(19);

    let j = 0;

    for (let i = 0; i < literalCount; i++) {
        lengths[j++] = literalCodeLengths[i];
    }

    for (let i = 0; i < distanceCount; i++) {
        lengths[j++] = distanceCodeLengths[i];
    }

    let resultCount = 0;

    for (let i = 0; i < lengths.length; i += j) {
        for (j = 1; i + j < lengths.length && lengths[i + j] === lengths[i]; j++) {
            // Count consecutive symbols without emitting values.
        }

        let runLength = j;

        // Symbols 17/18 repeat zero lengths; symbol 16 repeats the preceding nonzero length.
        if (lengths[i] === 0) {
            if (runLength < 3) {
                while (runLength-- > 0) {
                    result[resultCount++] = 0;
                    frequencies[0]++;
                }
            } else {
                while (runLength > 0) {
                    let repeatCount = Math.min(runLength, 138);

                    if (repeatCount > runLength - 3 && repeatCount < runLength) {
                        repeatCount = runLength - 3;
                    }

                    if (repeatCount <= 10) {
                        result[resultCount++] = 17;
                        result[resultCount++] = repeatCount - 3;
                        frequencies[17]++;
                    } else {
                        result[resultCount++] = 18;
                        result[resultCount++] = repeatCount - 11;
                        frequencies[18]++;
                    }

                    runLength -= repeatCount;
                }
            }
        } else {
            result[resultCount++] = lengths[i];
            frequencies[lengths[i]]++;
            runLength--;

            if (runLength < 3) {
                while (runLength-- > 0) {
                    result[resultCount++] = lengths[i];
                    frequencies[lengths[i]]++;
                }
            } else {
                while (runLength > 0) {
                    let repeatCount = Math.min(runLength, 6);

                    if (repeatCount > runLength - 3 && repeatCount < runLength) {
                        repeatCount = runLength - 3;
                    }

                    result[resultCount++] = 16;
                    result[resultCount++] = repeatCount - 3;
                    frequencies[16]++;

                    runLength -= repeatCount;
                }
            }
        }
    }

    return {
        codes: result.subarray(0, resultCount),
        frequencies,
    };
}

/**
 * Finds Huffman code lengths within a bit limit using reverse package merge.
 * @param {Uint32Array} frequencies The value frequencies.
 * @param {number} symbolCount The number of symbols.
 * @param {number} limit The code length limit.
 * @returns {Uint8Array} The code lengths.
 */
function reversePackageMerge(frequencies, symbolCount, limit) {
    const minimumCost = new Uint16Array(limit);
    const mergeFlags = new Uint8Array(limit);
    const codeLengths = new Uint8Array(symbolCount);
    const weights = new Array(limit);
    const symbolIndexes = new Array(limit);
    const currentPosition = new Array(limit);
    let excess = (1 << limit) - symbolCount;
    const half = (1 << (limit - 1));

    minimumCost[limit - 1] = symbolCount;

    // Determine how many leaves and merged pairs each tree level can contain.
    for (let i = 0; i < limit; i++) {
        if (excess < half) {
            mergeFlags[i] = 0;
        } else {
            mergeFlags[i] = 1;
            excess -= half;
        }

        excess <<= 1;
        minimumCost[limit - 2 - i] = (minimumCost[limit - 1 - i] / 2 | 0) + symbolCount;
    }

    minimumCost[0] = mergeFlags[0];

    weights[0] = new Array(minimumCost[0]);
    symbolIndexes[0] = new Array(minimumCost[0]);

    for (let i = 0; i < limit; i++) {
        if (minimumCost[i] > 2 * minimumCost[i - 1] + mergeFlags[i]) {
            minimumCost[i] = 2 * minimumCost[i - 1] + mergeFlags[i];
        }

        weights[i] = new Array(minimumCost[i]);
        symbolIndexes[i] = new Array(minimumCost[i]);
    }

    for (let i = 0; i < symbolCount; i++) {
        codeLengths[i] = limit;
    }

    for (let i = 0; i < minimumCost[limit - 1]; i++) {
        weights[limit - 1][i] = frequencies[i];
        symbolIndexes[limit - 1][i] = i;
    }

    for (let i = 0; i < limit; i++) {
        currentPosition[i] = 0;
    }

    if (mergeFlags[limit - 1] === 1) {
        codeLengths[0]--;
        currentPosition[limit - 1]++;
    }

    // A symbolCount marker represents a pair from the next level, rather than a leaf.
    function takePackage(level) {
        const symbolIndex = symbolIndexes[level][currentPosition[level]];

        if (symbolIndex === symbolCount) {
            takePackage(level + 1);
            takePackage(level + 1);
        } else {
            codeLengths[symbolIndex]--;
        }

        currentPosition[level]++;
    }

    // Merge pairs with leaf frequencies, then unpack selected pairs to shorten their codes.
    for (let i = limit - 2; i >= 0; i--) {
        let symbolIndex = 0;
        let next = currentPosition[i + 1];

        for (let j = 0; j < minimumCost[i]; j++) {
            const weight = weights[i + 1][next] + weights[i + 1][next + 1];

            if (weight > frequencies[symbolIndex]) {
                weights[i][j] = weight;
                symbolIndexes[i][j] = symbolCount;
                next += 2;
            } else {
                weights[i][j] = frequencies[symbolIndex];
                symbolIndexes[i][j] = symbolIndex;
                symbolIndex++;
            }
        }

        currentPosition[i] = 0;

        if (mergeFlags[i] === 1) {
            takePackage(i);
        }
    }

    return codeLengths;
}
