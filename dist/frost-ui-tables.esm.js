import { BaseComponent, generateId, initComponent } from "@fr0st/ui";
import $ from "@fr0st/query";

//#region src/js/helpers.js
/** @import { TableColumn, TableOrder } from './table.js'; */
/**
* Builds a text-only table from export data.
* @param {string[]} headings The column headings.
* @param {Array<Array<*>>} rows The displayed rows.
* @param {string} direction The table direction.
* @returns {HTMLTableElement} The table element.
*/
function buildTable(headings, rows, direction) {
	const table = $.create("table");
	$.setProperty(table, "dir", direction);
	const thead = $.create("thead");
	const tr = $.create("tr");
	for (const heading of headings) {
		const th = $.create("th", { text: heading });
		$.append(tr, th);
	}
	$.append(thead, tr);
	$.append(table, thead);
	const tbody = $.create("tbody");
	for (const row of rows) {
		const tr = $.create("tr");
		for (const value of row) {
			const td = $.create("td", { text: value });
			$.append(tr, td);
		}
		$.append(tbody, tr);
	}
	$.append(table, tbody);
	return table;
}
/**
* Builds a data array from a DOM element.
* @param {HTMLElement} element The element to parse.
* @returns {Array} The parsed data.
*/
function getDomData(element) {
	const tbody = $.findOne("tbody", element);
	return $.children(tbody, "tr").map((row) => $.children(row, "td").map((cell) => $.getHtml(cell)));
}
/**
* Builds a heading array from a DOM element.
* @param {HTMLElement} element The element to parse.
* @returns {Array} The parsed data.
*/
function getDomHeadings(element) {
	const thead = $.getProperty(element, "tHead");
	if (!thead) return [];
	const rows = $.getProperty(thead, "rows");
	if (rows.length > 1 || $.find("th", thead).some((cell) => $.getProperty(cell, "colSpan") !== 1 || $.getProperty(cell, "rowSpan") !== 1)) throw new RangeError("Table supports one heading row without spanning cells.");
	const row = rows[0];
	return $.children(row, "th").map((cell) => ({
		text: $.getHtml(cell),
		class: $.getAttribute(cell, "class")
	}));
}
/**
* Applies column defaults and validates the indexes used for alternate ordering.
* @param {TableColumn[]|null} columns The configured columns.
* @param {{text: string, class: string|null}[]} headings The parsed headings.
* @returns {TableColumn[]} The normalized columns.
*/
function normalizeColumns(columns, headings) {
	columns ??= headings.map((_, data) => ({ data }));
	if (headings.length && columns.length !== headings.length) throw new RangeError("Column definitions must match the heading count.");
	const normalized = columns.map((column, index) => ({
		class: null,
		data: index,
		dir: "asc",
		format: null,
		name: null,
		orderData: null,
		orderable: true,
		searchable: true,
		visible: true,
		createdCell: null,
		...column
	}));
	for (const column of normalized) if (column.orderData !== null) for (const index of column.orderData) validateColumnIndex(index, normalized.length);
	return normalized;
}
/**
* Validates and copies ordering, ignoring nonorderable columns.
* @param {TableOrder[]} order The requested order.
* @param {TableColumn[]} columns The normalized columns.
* @returns {TableOrder[]} The normalized order.
*/
function normalizeOrder(order, columns) {
	if (!Array.isArray(order)) throw new TypeError("Order must be an array.");
	const normalized = [];
	for (const entry of order) {
		if (!Array.isArray(entry) || entry.length !== 2 || !["asc", "desc"].includes(entry[1])) throw new TypeError("Order entries must contain a column index and asc/desc direction.");
		const [index, direction] = entry;
		if (!columns.length && index === 0) continue;
		validateColumnIndex(index, columns.length);
		if (columns[index].orderable) normalized.push([index, direction]);
	}
	return normalized;
}
/**
* Converts a page length to a positive integer for page offset calculations.
* @param {number|string} length The requested page length.
* @returns {number} The normalized length.
*/
function normalizePageLength(length) {
	length = Number(length);
	if (!Number.isSafeInteger(length) || length <= 0) throw new RangeError("Page length must be a positive integer.");
	return length;
}
/**
* Downloads a blob.
* @param {Blob} blob The blob to save.
* @param {string} filename The filename.
*/
function saveBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const link = $.create("a", { attributes: {
		href: url,
		download: filename
	} });
	try {
		$.append(document.body, link);
		$.click(link);
	} finally {
		$.detach(link);
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}
}
/**
* Validates a data column index.
* @param {number} index The column index.
* @param {number} count The number of columns.
*/
function validateColumnIndex(index, count) {
	if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError("Column index is out of range.");
}
/**
* Validates a local or remote row collection.
* @param {Array<Array<*>|Record<string, *>>} rows The supplied rows.
*/
function validateRows(rows) {
	if (!Array.isArray(rows) || rows.some((row) => !Array.isArray(row) && !$._isPlainObject(row))) throw new TypeError("Results must be an array of arrays or plain objects.");
}

//#endregion
//#region src/js/zip/helpers.js
var encoder = new TextEncoder();
var bitReverseTable = null;
var crc32Table = null;
/**
* Encodes a string as UTF-8 bytes.
* @param {string} string The string.
* @returns {Uint8Array} The encoded string.
*/
function encode(string) {
	return encoder.encode(string);
}
/**
* Gets the UTF-8 byte length of a string.
* @param {string} string The string.
* @returns {number} The byte length.
*/
function byteLength(string) {
	return encode(string).length;
}
/**
* Encodes an unsigned 16-bit integer in little-endian byte order.
* @param {number} number The number.
* @returns {Uint8Array} The encoded bytes.
*/
function encodeUint16(number) {
	const bytes = /* @__PURE__ */ new Uint8Array(2);
	new DataView(bytes.buffer).setUint16(0, number, true);
	return bytes;
}
/**
* Encodes an unsigned 32-bit integer in little-endian byte order.
* @param {number} number The number.
* @returns {Uint8Array} The encoded bytes.
*/
function encodeUint32(number) {
	const bytes = /* @__PURE__ */ new Uint8Array(4);
	new DataView(bytes.buffer).setUint32(0, number, true);
	return bytes;
}
/**
* Gets the cached bit reversal table for all possible byte values.
* @returns {Uint8Array} The bit reversal table.
*/
function getBitReverseTable() {
	if (bitReverseTable === null) {
		bitReverseTable = /* @__PURE__ */ new Uint8Array(256);
		for (let byte = 0; byte < 256; byte++) {
			let remaining = byte;
			let reversed = remaining;
			let shift = 7;
			for (remaining >>>= 1; remaining; remaining >>>= 1) {
				reversed <<= 1;
				reversed |= remaining & 1;
				shift--;
			}
			bitReverseTable[byte] = (reversed << shift & 255) >>> 0;
		}
	}
	return bitReverseTable;
}
/**
* Reverses the bits within a byte.
* @param {number} byte The byte to reverse.
* @returns {number} The reversed number.
*/
function reverseByte(byte) {
	return getBitReverseTable()[byte];
}
/**
* Reverses all 32 bits of an integer.
* @param {number} number The number to reverse.
* @returns {number} The reversed number.
*/
function reverseUint32(number) {
	const table = getBitReverseTable();
	return table[number & 255] << 24 | table[number >>> 8 & 255] << 16 | table[number >>> 16 & 255] << 8 | table[number >>> 24 & 255];
}
/**
* Gets the cached CRC32 table for the polynomial used by ZIP.
* @returns {Uint32Array} The CRC32 table.
*/
function getCrc32Table() {
	if (!crc32Table) {
		crc32Table = /* @__PURE__ */ new Uint32Array(256);
		for (let i = 0; i < 256; i++) {
			let checksum = i;
			for (let j = 0; j < 8; j++) checksum = checksum & 1 ? 3988292384 ^ checksum >>> 1 : checksum >>> 1;
			crc32Table[i] = checksum >>> 0;
		}
	}
	return crc32Table;
}

//#endregion
//#region src/js/zip/crc32.js
/**
* Calculates and updates ZIP CRC32 checksums.
* Adapted from https://github.com/imaya/zlib.js/blob/develop/src/crc32.js
*/
var CRC32 = class {
	/**
	* Gets the CRC32 hash value.
	* @param {Uint8Array} data The data to hash.
	* @param {number} [position] The data position.
	* @param {number} [length] The data length.
	* @returns {number} The CRC32 hash.
	*/
	static calc(data, position = 0, length = null) {
		return this.update(data, 0, position, length);
	}
	/**
	* Updates the CRC32 hash value.
	* @param {Uint8Array} data The data to hash.
	* @param {number} checksum The CRC32 hash.
	* @param {number} [position] The data position.
	* @param {number} [length] The data length.
	* @returns {number} The CRC32 hash.
	*/
	static update(data, checksum, position = 0, length = null) {
		if (length === null) length = data.length;
		checksum ^= 4294967295;
		const table = getCrc32Table();
		for (let i = length & 7; i--; ++position) checksum = checksum >>> 8 ^ table[(checksum ^ data[position]) & 255];
		for (let i = length >> 3; i--; position += 8) {
			checksum = checksum >>> 8 ^ table[(checksum ^ data[position]) & 255];
			checksum = checksum >>> 8 ^ table[(checksum ^ data[position + 1]) & 255];
			checksum = checksum >>> 8 ^ table[(checksum ^ data[position + 2]) & 255];
			checksum = checksum >>> 8 ^ table[(checksum ^ data[position + 3]) & 255];
			checksum = checksum >>> 8 ^ table[(checksum ^ data[position + 4]) & 255];
			checksum = checksum >>> 8 ^ table[(checksum ^ data[position + 5]) & 255];
			checksum = checksum >>> 8 ^ table[(checksum ^ data[position + 6]) & 255];
			checksum = checksum >>> 8 ^ table[(checksum ^ data[position + 7]) & 255];
		}
		return (checksum ^ 4294967295) >>> 0;
	}
};

//#endregion
//#region src/js/zip/bit-stream.js
/**
* Writes the bit stream used by DEFLATE.
* Adapted from https://github.com/imaya/zlib.js/blob/develop/src/bitstream.js
*/
var BitStream = class {
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
		if (this.#buffer.length <= this.#index) this.#expandBuffer();
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
		if (reverse && bitCount > 1) number = bitCount > 8 ? reverseUint32(number) >> 32 - bitCount : reverseByte(number) >> 8 - bitCount;
		let current = this.#buffer[this.#index];
		if (bitCount + this.#bitIndex < 8) {
			current = current << bitCount | number;
			this.#bitIndex += bitCount;
		} else for (let i = 0; i < bitCount; i++) {
			current = current << 1 | number >> bitCount - i - 1 & 1;
			if (++this.#bitIndex === 8) {
				this.#bitIndex = 0;
				this.#buffer[this.#index++] = reverseByte(current);
				current = 0;
				if (this.#index === this.#buffer.length) this.#expandBuffer();
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
};

//#endregion
//#region src/js/zip/heap.js
/**
* Stores symbol frequencies in a max heap.
* Adapted from https://github.com/imaya/zlib.js/blob/develop/src/heap.js
*/
var Heap = class {
	#buffer;
	#length;
	/**
	* Creates a Heap.
	* @param {number} [length] The size of the heap.
	*/
	constructor(length) {
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
			if (current >= this.#length) break;
			if (current + 2 < this.#length && this.#buffer[current + 2] > this.#buffer[current]) current += 2;
			if (this.#buffer[current] > this.#buffer[parent]) {
				let swap = this.#buffer[parent];
				this.#buffer[parent] = this.#buffer[current];
				this.#buffer[current] = swap;
				swap = this.#buffer[parent + 1];
				this.#buffer[parent + 1] = this.#buffer[current + 1];
				this.#buffer[current + 1] = swap;
			} else break;
			parent = current;
		}
		return {
			index,
			value
		};
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
			const parent = ((current - 2) / 4 | 0) * 2;
			if (this.#buffer[current] > this.#buffer[parent]) {
				let swap = this.#buffer[current];
				this.#buffer[current] = this.#buffer[parent];
				this.#buffer[parent] = swap;
				swap = this.#buffer[current + 1];
				this.#buffer[current + 1] = this.#buffer[parent + 1];
				this.#buffer[parent + 1] = swap;
				current = parent;
			} else break;
		}
	}
};

//#endregion
//#region src/js/zip/huffman.js
/**
* Gets the Huffman codes from the code lengths.
* @param {Uint8Array} lengths The code lengths.
* @returns {Uint16Array} The Huffman codes.
*/
function getCodesFromLengths(lengths) {
	const codes = new Uint16Array(lengths.length);
	const count = [];
	const startCode = [];
	let code = 0;
	for (let i = 0; i < lengths.length; i++) count[lengths[i]] = (count[lengths[i]] | 0) + 1;
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
			codes[i] = codes[i] << 1 | code & 1;
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
function getCodeLengths(frequencies, limit) {
	const heap = new Heap(572);
	const length = new Uint8Array(frequencies.length);
	for (let i = 0; i < frequencies.length; i++) if (frequencies[i] > 0) heap.push(i, frequencies[i]);
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
	for (let i = 0; i < nodes.length; i++) length[nodes[i].index] = codeLengths[i];
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
function getTreeSymbols(literalCount, literalCodeLengths, distanceCount, distanceCodeLengths) {
	const lengths = new Uint32Array(literalCount + distanceCount);
	const result = /* @__PURE__ */ new Uint32Array(316);
	const frequencies = /* @__PURE__ */ new Uint8Array(19);
	let j = 0;
	for (let i = 0; i < literalCount; i++) lengths[j++] = literalCodeLengths[i];
	for (let i = 0; i < distanceCount; i++) lengths[j++] = distanceCodeLengths[i];
	let resultCount = 0;
	for (let i = 0; i < lengths.length; i += j) {
		for (j = 1; i + j < lengths.length && lengths[i + j] === lengths[i]; j++);
		let runLength = j;
		if (lengths[i] === 0) {
			if (runLength < 3) while (runLength-- > 0) {
				result[resultCount++] = 0;
				frequencies[0]++;
			}
			else while (runLength > 0) {
				let repeatCount = Math.min(runLength, 138);
				if (repeatCount > runLength - 3 && repeatCount < runLength) repeatCount = runLength - 3;
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
		} else {
			result[resultCount++] = lengths[i];
			frequencies[lengths[i]]++;
			runLength--;
			if (runLength < 3) while (runLength-- > 0) {
				result[resultCount++] = lengths[i];
				frequencies[lengths[i]]++;
			}
			else while (runLength > 0) {
				let repeatCount = Math.min(runLength, 6);
				if (repeatCount > runLength - 3 && repeatCount < runLength) repeatCount = runLength - 3;
				result[resultCount++] = 16;
				result[resultCount++] = repeatCount - 3;
				frequencies[16]++;
				runLength -= repeatCount;
			}
		}
	}
	return {
		codes: result.subarray(0, resultCount),
		frequencies
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
	const half = 1 << limit - 1;
	minimumCost[limit - 1] = symbolCount;
	for (let i = 0; i < limit; i++) {
		if (excess < half) mergeFlags[i] = 0;
		else {
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
		if (minimumCost[i] > 2 * minimumCost[i - 1] + mergeFlags[i]) minimumCost[i] = 2 * minimumCost[i - 1] + mergeFlags[i];
		weights[i] = new Array(minimumCost[i]);
		symbolIndexes[i] = new Array(minimumCost[i]);
	}
	for (let i = 0; i < symbolCount; i++) codeLengths[i] = limit;
	for (let i = 0; i < minimumCost[limit - 1]; i++) {
		weights[limit - 1][i] = frequencies[i];
		symbolIndexes[limit - 1][i] = i;
	}
	for (let i = 0; i < limit; i++) currentPosition[i] = 0;
	if (mergeFlags[limit - 1] === 1) {
		codeLengths[0]--;
		currentPosition[limit - 1]++;
	}
	function takePackage(level) {
		const symbolIndex = symbolIndexes[level][currentPosition[level]];
		if (symbolIndex === symbolCount) {
			takePackage(level + 1);
			takePackage(level + 1);
		} else codeLengths[symbolIndex]--;
		currentPosition[level]++;
	}
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
		if (mergeFlags[i] === 1) takePackage(i);
	}
	return codeLengths;
}

//#endregion
//#region src/js/zip/lz77-helpers.js
var lengthCodeTable = null;
/**
* Gets the DEFLATE symbol, extra-bit value, and bit count for a match length.
* @param {number} length The length.
* @returns {Array} The LZ77 length codes.
*/
function generateLengthCodes(length) {
	switch (true) {
		case length === 3: return [
			257,
			length - 3,
			0
		];
		case length === 4: return [
			258,
			length - 4,
			0
		];
		case length === 5: return [
			259,
			length - 5,
			0
		];
		case length === 6: return [
			260,
			length - 6,
			0
		];
		case length === 7: return [
			261,
			length - 7,
			0
		];
		case length === 8: return [
			262,
			length - 8,
			0
		];
		case length === 9: return [
			263,
			length - 9,
			0
		];
		case length === 10: return [
			264,
			length - 10,
			0
		];
		case length <= 12: return [
			265,
			length - 11,
			1
		];
		case length <= 14: return [
			266,
			length - 13,
			1
		];
		case length <= 16: return [
			267,
			length - 15,
			1
		];
		case length <= 18: return [
			268,
			length - 17,
			1
		];
		case length <= 22: return [
			269,
			length - 19,
			2
		];
		case length <= 26: return [
			270,
			length - 23,
			2
		];
		case length <= 30: return [
			271,
			length - 27,
			2
		];
		case length <= 34: return [
			272,
			length - 31,
			2
		];
		case length <= 42: return [
			273,
			length - 35,
			3
		];
		case length <= 50: return [
			274,
			length - 43,
			3
		];
		case length <= 58: return [
			275,
			length - 51,
			3
		];
		case length <= 66: return [
			276,
			length - 59,
			3
		];
		case length <= 82: return [
			277,
			length - 67,
			4
		];
		case length <= 98: return [
			278,
			length - 83,
			4
		];
		case length <= 114: return [
			279,
			length - 99,
			4
		];
		case length <= 130: return [
			280,
			length - 115,
			4
		];
		case length <= 162: return [
			281,
			length - 131,
			5
		];
		case length <= 194: return [
			282,
			length - 163,
			5
		];
		case length <= 226: return [
			283,
			length - 195,
			5
		];
		case length <= 257: return [
			284,
			length - 227,
			5
		];
		case length === 258: return [
			285,
			length - 258,
			0
		];
	}
}
/**
* Gets the cached length codes for DEFLATE matches of 3 to 258 bytes.
* @returns {Array} The length code table.
*/
function getLengthCodeTable() {
	if (!lengthCodeTable) {
		lengthCodeTable = [];
		for (let i = 3; i <= 258; i++) {
			const codes = generateLengthCodes(i);
			lengthCodeTable[i] = codes[2] << 24 | codes[1] << 16 | codes[0];
		}
	}
	return lengthCodeTable;
}
/**
* Gets the distance code.
* @param {number} distance The distance.
* @returns {Array} The distance code.
*/
function getDistanceCode(distance) {
	switch (true) {
		case distance === 1: return [
			0,
			distance - 1,
			0
		];
		case distance === 2: return [
			1,
			distance - 2,
			0
		];
		case distance === 3: return [
			2,
			distance - 3,
			0
		];
		case distance === 4: return [
			3,
			distance - 4,
			0
		];
		case distance <= 6: return [
			4,
			distance - 5,
			1
		];
		case distance <= 8: return [
			5,
			distance - 7,
			1
		];
		case distance <= 12: return [
			6,
			distance - 9,
			2
		];
		case distance <= 16: return [
			7,
			distance - 13,
			2
		];
		case distance <= 24: return [
			8,
			distance - 17,
			3
		];
		case distance <= 32: return [
			9,
			distance - 25,
			3
		];
		case distance <= 48: return [
			10,
			distance - 33,
			4
		];
		case distance <= 64: return [
			11,
			distance - 49,
			4
		];
		case distance <= 96: return [
			12,
			distance - 65,
			5
		];
		case distance <= 128: return [
			13,
			distance - 97,
			5
		];
		case distance <= 192: return [
			14,
			distance - 129,
			6
		];
		case distance <= 256: return [
			15,
			distance - 193,
			6
		];
		case distance <= 384: return [
			16,
			distance - 257,
			7
		];
		case distance <= 512: return [
			17,
			distance - 385,
			7
		];
		case distance <= 768: return [
			18,
			distance - 513,
			8
		];
		case distance <= 1024: return [
			19,
			distance - 769,
			8
		];
		case distance <= 1536: return [
			20,
			distance - 1025,
			9
		];
		case distance <= 2048: return [
			21,
			distance - 1537,
			9
		];
		case distance <= 3072: return [
			22,
			distance - 2049,
			10
		];
		case distance <= 4096: return [
			23,
			distance - 3073,
			10
		];
		case distance <= 6144: return [
			24,
			distance - 4097,
			11
		];
		case distance <= 8192: return [
			25,
			distance - 6145,
			11
		];
		case distance <= 12288: return [
			26,
			distance - 8193,
			12
		];
		case distance <= 16384: return [
			27,
			distance - 12289,
			12
		];
		case distance <= 24576: return [
			28,
			distance - 16385,
			13
		];
		case distance <= 32768: return [
			29,
			distance - 24577,
			13
		];
	}
}
/**
* Gets the length code.
* @param {number} length The length.
* @returns {number} The length code.
*/
function getLengthCode(length) {
	return getLengthCodeTable()[length];
}

//#endregion
//#region src/js/zip/lz77-match.js
/**
* Encodes a repeated byte sequence as DEFLATE length and distance symbols.
* Adapted from https://github.com/imaya/zlib.js/blob/develop/src/rawdeflate.js
*/
var Lz77Match = class {
	#backwardDistance;
	#length;
	/**
	* Creates a Lz77Match.
	* @param {number} length The length of the match.
	* @param {number} backwardDistance The distance to the matching sequence.
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
	* Gets the LZ77 coded array.
	* @returns {Array} The LZ77 Array.
	*/
	toLz77Array() {
		const lengthCode = getLengthCode(this.#length);
		const distanceCode = getDistanceCode(this.#backwardDistance);
		return [
			lengthCode & 65535,
			lengthCode >> 16 & 255,
			lengthCode >> 24,
			...distanceCode
		];
	}
};

//#endregion
//#region src/js/zip/raw-deflate.js
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
var RawDeflate = class {
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
		return new this(data, options).compress();
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
			...options
		};
		this.#input = input;
		this.#lazyThreshold = options.lazy;
		this.#minMatchLength = options.lz77MinLength;
		this.#maxMatchLength = options.lz77MaxLength;
		this.#outputIndex = 0;
		this.#output = /* @__PURE__ */ new Uint8Array(32768);
	}
	/**
	* Compresses the data.
	* @returns {Uint8Array} The compressed data.
	*/
	compress() {
		const stream = new BitStream(new Uint8Array(this.#output.buffer), this.#outputIndex);
		const finalBlock = 1;
		const blockType = 2;
		stream.writeBits(finalBlock, 1, true);
		stream.writeBits(blockType, 2, true);
		const tokens = this.#getLz77Tokens();
		const literalCodeLengths = getCodeLengths(this.#literalFrequencies, 15);
		const literalCodes = getCodesFromLengths(literalCodeLengths);
		const distanceCodeLengths = getCodeLengths(this.#distanceFrequencies, 7);
		const distanceCodes = getCodesFromLengths(distanceCodeLengths);
		let literalCount = 286;
		let distanceCount = 30;
		while (literalCount > 257 && literalCodeLengths[literalCount - 1] === 0) literalCount--;
		while (distanceCount > 1 && distanceCodeLengths[distanceCount - 1] === 0) distanceCount--;
		const treeSymbols = getTreeSymbols(literalCount, literalCodeLengths, distanceCount, distanceCodeLengths);
		const treeLengths = getCodeLengths(treeSymbols.frequencies, 7);
		const orderedCodeLengths = [
			16,
			17,
			18,
			0,
			8,
			7,
			9,
			6,
			10,
			5,
			11,
			4,
			12,
			3,
			13,
			2,
			14,
			1,
			15
		].map((code) => treeLengths[code]);
		let codeLengthCount = 19;
		while (codeLengthCount > 4 && orderedCodeLengths[codeLengthCount - 1] === 0) codeLengthCount--;
		const treeCodes = getCodesFromLengths(treeLengths);
		stream.writeBits(literalCount - 257, 5, true);
		stream.writeBits(distanceCount - 1, 5, true);
		stream.writeBits(codeLengthCount - 4, 4, true);
		for (let i = 0; i < codeLengthCount; i++) stream.writeBits(orderedCodeLengths[i], 3, true);
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
					case 18: bitLength = 7;
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
			} else if (literal === 256) break;
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
		candidate: for (let i = 0; i < length; i++) {
			const match = matchList[length - i - 1];
			let matchLength = this.#minMatchLength;
			if (longestLength > this.#minMatchLength) {
				for (let j = longestLength; j > this.#minMatchLength; j--) if (this.#input[match + j - 1] !== this.#input[position + j - 1]) continue candidate;
				matchLength = longestLength;
			}
			while (matchLength < this.#maxMatchLength && position + matchLength < this.#input.length && this.#input[match + matchLength] === this.#input[position + matchLength]) matchLength++;
			if (matchLength > longestLength) {
				matchPosition = match;
				longestLength = matchLength;
			}
			if (matchLength === this.#maxMatchLength) break;
		}
		return new Lz77Match(longestLength, position - matchPosition);
	}
	/**
	* Builds literal and match tokens while counting their Huffman symbol frequencies.
	* @returns {Uint16Array} The literal and match tokens.
	*/
	#getLz77Tokens() {
		const tokens = new Uint16Array(this.#input.length * 2);
		const literalFrequencies = /* @__PURE__ */ new Uint32Array(286);
		const distanceFrequencies = /* @__PURE__ */ new Uint32Array(30);
		literalFrequencies[256] = 1;
		const matchesByKey = {};
		let tokenIndex = 0;
		let skipLength = 0;
		let previousMatch;
		const writeMatch = (match, offset) => {
			const matchTokens = match.toLz77Array();
			for (let i = 0; i < matchTokens.length; i++) tokens[tokenIndex++] = matchTokens[i];
			literalFrequencies[matchTokens[0]]++;
			distanceFrequencies[matchTokens[3]]++;
			skipLength = match.length + offset - 1;
			previousMatch = null;
		};
		for (let position = 0; position < this.#input.length; position++) {
			let matchKey = 0;
			for (let i = 0; i < this.#minMatchLength; i++) {
				if (position + i === this.#input.length) break;
				matchKey = matchKey << 8 | this.#input[position + i];
			}
			if (!(matchKey in matchesByKey)) matchesByKey[matchKey] = [];
			const matchList = matchesByKey[matchKey];
			if (skipLength-- > 0) {
				matchList.push(position);
				continue;
			}
			while (matchList.length > 0 && position - matchList[0] > 32768) matchList.shift();
			if (position + this.#minMatchLength >= this.#input.length) {
				if (previousMatch) writeMatch(previousMatch, -1);
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
					} else writeMatch(previousMatch, -1);
				} else if (longestMatch.length < this.#lazyThreshold) previousMatch = longestMatch;
				else writeMatch(longestMatch, 0);
			} else if (previousMatch) writeMatch(previousMatch, -1);
			else {
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
};

//#endregion
//#region src/js/zip/zip.js
/**
* Builds ZIP archives from UTF-8 files.
* Adapted from https://github.com/shuchkin/simplexlsxgen/blob/master/src/SimpleXLSXGen.php
*/
var Zip = class {
	#directory = [];
	#entries = 0;
	#files = [];
	#offset = 0;
	#type;
	/**
	* Creates a Zip.
	* @param {string} [type=octet/stream] The file type.
	*/
	constructor(type = "octet/stream") {
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
		if (uncompressedSize >= 256) {
			data = RawDeflate.compress(data);
			compressedSize = data.byteLength;
			compressionMethod = 8;
		}
		const now = /* @__PURE__ */ new Date();
		const year = Math.min(2107, Math.max(1980, now.getFullYear()));
		const modifiedTime = now.getHours() << 11 | now.getMinutes() << 5 | Math.floor(now.getSeconds() / 2);
		const modifiedDate = year - 1980 << 9 | now.getMonth() + 1 << 5 | now.getDate();
		const directory = [
			encode("PK"),
			encodeUint16(0),
			encodeUint16(versionNeeded),
			encodeUint16(2048),
			encodeUint16(compressionMethod),
			encodeUint16(modifiedTime),
			encodeUint16(modifiedDate),
			encodeUint32(crc32),
			encodeUint32(compressedSize),
			encodeUint32(uncompressedSize),
			encodeUint16(filenameLength),
			encodeUint16(0),
			encodeUint16(0),
			encodeUint16(0),
			encodeUint16(0),
			encodeUint32(32),
			encodeUint32(this.#offset),
			encode(filename)
		];
		this.#directory.push(...directory);
		const file = [
			encode("PK"),
			encodeUint16(versionNeeded),
			encodeUint16(2048),
			encodeUint16(compressionMethod),
			encodeUint16(modifiedTime),
			encodeUint16(modifiedDate),
			encodeUint32(crc32),
			encodeUint32(compressedSize),
			encodeUint32(uncompressedSize),
			encodeUint16(filenameLength),
			encodeUint16(0),
			encode(filename),
			data
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
		return new Blob([
			...this.#files,
			...this.#directory,
			encode("PK"),
			encodeUint16(0),
			encodeUint16(0),
			encodeUint16(this.#entries),
			encodeUint16(this.#entries),
			encodeUint32(directoryLength),
			encodeUint32(this.#offset),
			encodeUint16(0)
		], { type: this.#type });
	}
};

//#endregion
//#region src/js/workbook/helpers.js
/**
* Converts a one-based Excel column number to its letter name.
* @param {number} num The column number.
* @returns {string} The column name.
*/
function colName(num) {
	if (!Number.isInteger(num) || num < 1) throw new RangeError("Column must be a positive integer.");
	let result = "";
	while (num) {
		num--;
		result = String.fromCharCode(65 + num % 26) + result;
		num = Math.floor(num / 26);
	}
	return result;
}
/**
* Escapes XML text and attributes, removing characters forbidden by XML 1.0.
* @param {string} string The input text.
* @returns {string} The escaped text.
*/
function escape(string) {
	return Array.from(String(string)).filter((character) => {
		const code = character.codePointAt(0);
		return (code >= 32 || [
			9,
			10,
			13
		].includes(code)) && code !== 65534 && code !== 65535;
	}).join("").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&apos;");
}
/**
* Converts date parts to the Excel 1900 date system, including its leap-day convention.
* @param {number|string} year The year; zero represents a time without a date.
* @param {number|string} month The one-based month.
* @param {number|string} day The day.
* @param {number|string} [hours=0] The hours.
* @param {number|string} [minutes=0] The minutes.
* @param {number|string} [seconds=0] The seconds.
* @returns {number} The Excel serial value.
*/
function formatDate(year, month, day, hours = 0, minutes = 0, seconds = 0) {
	[year, month, day, hours, minutes, seconds] = [
		year,
		month,
		day,
		hours,
		minutes,
		seconds
	].map(Number);
	if (![
		year,
		month,
		day,
		hours,
		minutes,
		seconds
	].every(Number.isInteger) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) throw new RangeError("Invalid date or time.");
	const fraction = (hours * 3600 + minutes * 60 + seconds) / 86400;
	if (!year) return fraction;
	if (year === 1900 && month === 2 && day === 29) return 60 + fraction;
	const date = new Date(Date.UTC(year, month - 1, day));
	if (year < 1900 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new RangeError("Invalid date.");
	const days = (date.getTime() - Date.UTC(1899, 11, 31)) / 864e5;
	return days + (days >= 60 ? 1 : 0) + fraction;
}

//#endregion
//#region src/js/workbook/templates.js
var templates = {
	"[Content_Types].xml": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Override PartName=\"/_rels/.rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/><Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/><Override PartName=\"/xl/_rels/workbook.xml.rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>{sheets}<Override PartName=\"/xl/sharedStrings.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/></Types>",
	"_rels/.rels": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/></Relationships>",
	"docProps/app.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\"><TotalTime>0</TotalTime><Application>FrostUI-Tables</Application></Properties>",
	"docProps/core.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><dcterms:created xsi:type=\"dcterms:W3CDTF\">{date}</dcterms:created><dc:language>en-US</dc:language><dcterms:modified xsi:type=\"dcterms:W3CDTF\">{date}</dcterms:modified><cp:revision>1</cp:revision></cp:coreProperties>",
	"xl/_rels/workbook.xml.rels": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>{sheets}",
	"xl/worksheets/sheet1.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><dimension ref=\"{ref}\"/><cols>{cols}</cols><sheetData>{rows}</sheetData></worksheet>",
	"xl/sharedStrings.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" count=\"{cnt}\" uniqueCount=\"{unique}\">{strings}</sst>",
	"xl/styles.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"2\"><font><name val=\"Calibri\"/><family val=\"2\"/></font><font><name val=\"Calibri\"/><family val=\"2\"/><b/></font></fonts><fills count=\"1\"><fill><patternFill patternType=\"none\"/></fill></fills><borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" /></cellStyleXfs><cellXfs count=\"9\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"1\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"9\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"10\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"14\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"20\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"22\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\" applyAlignment=\"1\"><alignment horizontal=\"right\"/></xf><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"/></cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>",
	"xl/workbook.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><fileVersion appName=\"FrostUI-Tables\"/><sheets>{sheets}</sheets></workbook>"
};

//#endregion
//#region src/js/workbook/workbook.js
var cellStyles = {
	percent: 2,
	decimalPercent: 3,
	date: 4,
	time: 5,
	dateTime: 6,
	heading: 8
};
/**
* Builds Excel workbooks from rows, headings, and optional footers.
* Adapted from https://github.com/shuchkin/simplexlsxgen/blob/master/src/SimpleXLSXGen.php
*/
var Workbook = class {
	#sheetCount = 0;
	#sheets = [];
	#stringCount = 0;
	#stringIndexes = /* @__PURE__ */ new Map();
	#strings = [];
	/**
	* Adds a sheet to the Workbook.
	* @param {object} data The sheet data.
	* @param {string} [name] The name of the sheet.
	*/
	addSheet(data, name = null) {
		this.#sheetCount++;
		if (!name) name = `Sheet${this.#sheetCount}`;
		name = String(name).replace(/[\\/?*[\]:]/g, "").replace(/^'+|'+$/g, "").slice(0, 31) || `Sheet${this.#sheetCount}`;
		const base = name;
		let suffix = 1;
		while (this.#sheets.some((sheet) => sheet.name.toLowerCase() === name.toLowerCase())) {
			const tail = ` (${suffix++})`;
			name = base.slice(0, 31 - tail.length) + tail;
		}
		this.#sheets.push({
			name,
			data
		});
	}
	/**
	* Creates an xlsx file.
	* @returns {Blob} The xlsx file.
	*/
	create() {
		if (!this.#sheets.length) this.addSheet({ rows: [] });
		this.#stringIndexes = /* @__PURE__ */ new Map();
		this.#strings = [];
		this.#stringCount = 0;
		const worksheetTemplate = templates["xl/worksheets/sheet1.xml"];
		const worksheets = this.#sheets.map((sheet) => this.#sheetToXml(sheet, worksheetTemplate));
		const zip = new Zip("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
		for (const [filename, source] of Object.entries(templates)) {
			let template = source;
			switch (filename) {
				case "[Content_Types].xml": {
					const override = this.#sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
					template = template.replace("{sheets}", override);
					break;
				}
				case "xl/_rels/workbook.xml.rels": {
					let relationships = this.#sheets.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>\n`).join("");
					relationships += `<Relationship Id="rId${this.#sheets.length + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
					template = template.replace("{sheets}", relationships);
					break;
				}
				case "xl/workbook.xml": {
					const sheets = this.#sheets.map((sheet, index) => `<sheet name="${escape(sheet.name)}" sheetId="${index + 1}" state="visible" r:id="rId${index + 2}"/>`).join("");
					template = template.replace("{sheets}", sheets);
					break;
				}
				case "docProps/core.xml": {
					const date = (/* @__PURE__ */ new Date()).toISOString().substring(0, 19) + "Z";
					template = template.replaceAll("{date}", date);
					break;
				}
				case "xl/sharedStrings.xml": {
					const strings = this.#strings.map((string) => `<si><t xml:space="preserve">${string}</t></si>`).join("\r\n");
					template = template.replace("{cnt}", String(this.#stringCount)).replace("{unique}", String(this.#strings.length)).replace("{strings}", strings);
					break;
				}
				case "xl/worksheets/sheet1.xml":
					for (const [index, xml] of worksheets.entries()) zip.addFile(`xl/worksheets/sheet${index + 1}.xml`, xml);
					continue;
			}
			zip.addFile(filename, template);
		}
		return zip.zip();
	}
	/**
	* Serializes a value without interpreting strings as spreadsheet formulas.
	* @param {*} value The cell value.
	* @param {string} reference The cell reference.
	* @param {number|null} defaultStyle The optional header/footer style.
	* @returns {string} The cell XML.
	*/
	#cellToXml(value, reference, defaultStyle) {
		if (value === null || value === void 0 || value === "") return "";
		let type = null;
		let style = defaultStyle;
		let content;
		const text = String(value);
		if (typeof value === "boolean") {
			type = "b";
			content = value ? 1 : 0;
		} else if (typeof value === "number" && Number.isFinite(value) || /^[-+]?(?:0|[1-9]\d{0,14})(?:\.\d+)?$/.test(text)) content = Number(value);
		else if (/^[-+]?\d+(?:\.\d+)?%$/.test(text)) {
			content = Number.parseFloat(text) / 100;
			style ??= text.includes(".") ? cellStyles.decimalPercent : cellStyles.percent;
		} else {
			const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
			const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
			const time = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);
			try {
				if (iso || dmy) {
					const match = iso || dmy;
					const year = iso ? match[1] : match[3];
					const day = iso ? match[3] : match[1];
					content = formatDate(year, match[2], day, match[4] || 0, match[5] || 0, match[6] || 0);
					style ??= match[4] ? cellStyles.dateTime : cellStyles.date;
				} else if (time) {
					content = formatDate(0, 0, 0, ...time.slice(1));
					style ??= cellStyles.time;
				}
			} catch {}
			if (content === void 0) {
				const escaped = escape(text);
				if (text.length > 160) {
					type = "inlineStr";
					content = escaped;
				} else {
					type = "s";
					this.#stringCount++;
					if (!this.#stringIndexes.has(escaped)) {
						this.#stringIndexes.set(escaped, this.#strings.length);
						this.#strings.push(escaped);
					}
					content = this.#stringIndexes.get(escaped);
				}
			}
		}
		let attributes = `r="${reference}"`;
		if (type) attributes += ` t="${type}"`;
		if (style !== null) attributes += ` s="${style}"`;
		const cellValue = type === "inlineStr" ? `<is><t xml:space="preserve">${content}</t></is>` : `<v>${content}</v>`;
		return `<c ${attributes}>${cellValue}</c>`;
	}
	/**
	* Converts a sheet object to an XML string.
	* @param {object} sheet The sheet.
	* @param {string} template The XML template.
	* @returns {string} The XML string.
	*/
	#sheetToXml(sheet, template) {
		const widths = [];
		const rows = [];
		const data = [];
		if (sheet.data.header) data.push({
			values: sheet.data.header,
			style: cellStyles.heading
		});
		for (const values of sheet.data.rows || []) data.push({
			values,
			style: null
		});
		if (sheet.data.footer) data.push({
			values: sheet.data.footer,
			style: cellStyles.heading
		});
		if (data.length > 1048576) throw new RangeError("Too many worksheet rows.");
		for (const [index, { values, style }] of data.entries()) {
			if (!Array.isArray(values) || values.length > 16384) throw new RangeError("Invalid worksheet row.");
			const cells = values.map((value, column) => {
				widths[column] = Math.max(widths[column] || 0, String(value ?? "").length);
				return this.#cellToXml(value, `${colName(column + 1)}${index + 1}`, style);
			}).join("");
			rows.push(`<row r="${index + 1}">${cells}</row>`);
		}
		const columns = widths.map((width, index) => {
			const column = index + 1;
			return `<col min="${column}" max="${column}" width="${Math.min(width + 5, 60)}"/>`;
		});
		const reference = rows.length && widths.length ? `A1:${colName(widths.length)}${rows.length}` : "A1";
		return template.replace("{ref}", reference).replace("{cols}", columns.join("")).replace("{rows}", rows.join(""));
	}
};

//#endregion
//#region src/js/buttons.js
/**
* Downloads the displayed rows as CSV, escaping delimiters, quotes and line breaks.
* @param {object} options The button options.
* @param {string} [options.title] The download title.
* @param {boolean} [options.escapeFormulae=true] Prefix spreadsheet formula-like strings with an apostrophe.
* @param {object} data The export data.
* @param {string[]} data.headings The headings.
* @param {Array<Array<*>>} data.rows The displayed rows.
*/
function csv(options, { headings, rows }) {
	const title = options.title || document.title;
	const lines = [headings, ...rows].map((row) => {
		return row.map((value) => {
			let text = String(value ?? "");
			if (options.escapeFormulae !== false && typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
			if (/[",\r\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
			return text;
		}).join(",");
	});
	const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
	saveBlob(blob, `${title}.csv`);
}
/**
* Downloads the displayed rows as an Excel workbook.
* @param {object} options The button options.
* @param {object} data The export data.
* @param {string[]} data.headings The headings.
* @param {Array<Array<*>>} data.rows The displayed rows.
*/
function excel(options, { headings, rows }) {
	const workbook = new Workbook();
	workbook.addSheet({
		header: headings,
		rows
	});
	saveBlob(workbook.create(), `${options.title || document.title}.xlsx`);
}
/**
* Opens a text-only print view and waits for its styles and fonts.
* @param {object} options The button options.
* @param {HTMLTableElement} table The table to print.
* @param {string} classes The table classes.
* @returns {Promise<void>} Completion of print preparation, or nothing when blocked.
*/
async function print(options, table, classes) {
	const win = window.open("", "_blank");
	if (!win) return;
	const title = options.title || document.title;
	win.document.title = title;
	win.document.documentElement.dir = $.getProperty(table, "dir") || document.documentElement.dir;
	const heading = win.document.createElement("h1");
	$.setText(heading, title);
	$.addClass(table, classes || "");
	$.append(win.document.body, [heading, table]);
	const loads = [];
	for (const element of $.find("link[rel=\"stylesheet\"], style")) {
		const clone = win.document.importNode(element, true);
		if ($.tagName(clone) === "link") {
			$.setProperty(clone, "href", $.getProperty(element, "href"));
			loads.push(new Promise((resolve) => {
				$.addEventOnce(clone, "load", resolve);
				$.addEventOnce(clone, "error", resolve);
			}));
		}
		$.append(win.document.head, clone);
	}
	try {
		await Promise.all(loads);
		await win.document.fonts.ready;
		if (win.closed) return;
		win.focus();
		win.print();
	} finally {
		if (!win.closed) win.close();
	}
}

//#endregion
//#region src/js/table.js
/** @typedef {Array<*>|Record<string, *>} TableRow */
/** @typedef {[number, 'asc'|'desc']} TableOrder */
/**
* @typedef {object} TableColumn
* @property {string|number} [data] The row key or dot path; defaults to the column index.
* @property {string|null} [name=null] The remote column name.
* @property {string|null} [class=null] The cell classes.
* @property {'asc'|'desc'} [dir='asc'] The first sort direction.
* @property {number[]|null} [orderData=null] Alternate sort column indexes.
* @property {boolean} [orderable=true] Whether the column can be sorted.
* @property {boolean} [searchable=true] Whether local searches include the column.
* @property {boolean} [visible=true] Whether the column is displayed.
* @property {function(*): *} [format] Formats a cell value as HTML.
* @property {function(HTMLTableCellElement, *, TableRow, number, number): void} [createdCell] Receives a created cell.
*/
/**
* @typedef {object} TableButton
* @property {string} [type] The registered button type.
* @property {string} [text] The button label.
* @property {string} [title] The export title, defaulting to the document title.
* @property {number[]} [columns] The columns to export; defaults to visible columns.
* @property {boolean} [escapeFormulae=true] Prefixes formula-like CSV strings with an apostrophe.
* @property {function(this: Table): void} [callback] Runs with the table as its receiver.
*/
/**
* @typedef {object} TableRequest
* @property {string} [term] The search term, omitted when empty.
* @property {Record<number, {column: number, dir: string}>} [order] Remote ordering.
* @property {Record<number, {data: string|number, name?: string, orderable: boolean, searchable: boolean}>} columns The column definitions.
* @property {number} [offset] The zero-based offset when paging is enabled.
* @property {number} [limit] The page length when paging is enabled.
*/
/**
* @typedef {object} TableResults
* @property {TableRow[]} results The rows for the requested page.
* @property {number} total The total number of rows before filtering.
* @property {number} filtered The total number of matching rows.
*/
/**
* @typedef {object} TableOptions
* @property {TableRow[]} [data] Local data; otherwise read the table body.
* @property {function(TableRequest): (TableResults|PromiseLike<TableResults>)} [getResults] Loads remote rows.
* @property {TableColumn[]|null} [columns=null] The column definitions.
* @property {function(string): string} [sanitize] Sanitizes HTML cells and headings; defaults to query sanitization.
* @property {TableButton[]} [buttons=[]] The export and custom buttons.
* @property {{top?: string, bottom?: string}} [layout] Comma-separated columns containing pipe-separated controls.
* @property {Record<string, string|Record<string, string>>} [lang] The interface labels.
* @property {Record<string, string>} [icons] The pagination icons.
* @property {'filled'|'outline'} [inputStyle='filled'] The generated input style.
* @property {TableOrder[]} [order] The initial ordering; defaults to column zero ascending.
* @property {number[]} [lengths] Available page lengths; defaults to 10, 25, 50, and 100.
* @property {number} [length=10] The initial page length.
* @property {number} [debounce=250] The local search or remote request delay in milliseconds.
* @property {boolean} [info=true] Whether to render result counts.
* @property {boolean} [lengthChange=true] Whether users can change the page length.
* @property {boolean} [ordering=true] Whether rows can be sorted.
* @property {boolean} [paging=true] Whether rows are paginated.
* @property {boolean} [searching=true] Whether rows can be searched.
* @property {function(HTMLTableRowElement, TableRow, number): void} [createdRow] Receives an inserted row.
* @property {function(HTMLTableRowElement, TableRow, number, number, number): void} [rowCallback] Receives a rendered row and its indexes.
* @property {function(HTMLTableRowElement, TableRow[], number, number, number[]): void} [headerCallback] Receives the heading row and data range.
* @property {function(HTMLTableSectionElement, TableRow[], number, number, number[]): void} [footerCallback] Receives the footer and data range.
* @property {function(number, number, number, number, string): string} [infoCallback] Formats the result count text.
* @property {function(): (boolean|void)} [preDrawCallback] Runs before drawing; return false to keep the existing DOM.
* @property {function(): void} [drawCallback] Runs after drawing rows.
*/
/**
* Controls a sortable, searchable table with local or remote rows.
* @augments {BaseComponent<TableOptions>}
*/
var Table = class extends BaseComponent {
	static buttons = {
		csv(options) {
			csv(options, this.#getExportData(options));
		},
		excel(options) {
			excel(options, this.#getExportData(options));
		},
		print(options) {
			const { headings, rows } = this.#getExportData(options);
			const table = buildTable(headings, rows, $.css(this.node, "direction"));
			print(options, table, $.getAttribute(this.node, "class"));
		}
	};
	static classes = {
		bottomRow: "d-md-flex justify-content-between",
		button: "btn btn-table",
		buttonGroup: "btn-group btn-group-sm mt-1",
		column: "d-md-flex",
		columnContainer: "text-center px-2 mb-1",
		container: "position-relative mb-2",
		emptyCell: "text-center py-3",
		infoContainer: "text-center text-md-start mb-2 mb-md-0 w-100",
		lengthContainer: "d-flex justify-content-center justify-content-md-start w-100 mb-1",
		lengthInputContainer: "form-input d-inline-block",
		lengthInputFilled: "input-filled input-sm",
		lengthInputOutline: "input-outline input-sm",
		lengthLabel: "mb-1 mb-md-0",
		lengthLabelText: "me-2",
		loader: "position-absolute top-50 start-50 translate-middle z-1",
		loaderIcon: "spinner-border text-primary",
		pageActive: "active",
		pageDisabled: "disabled",
		pageItem: "page-item",
		pageLink: "page-link ripple",
		pagination: "pagination pagination-sm mx-auto me-md-0",
		paginationContainer: "d-flex w-100",
		searchContainer: "w-100 mb-1",
		searchInputContainer: "form-input mx-auto me-md-0",
		searchInputFilled: "input-filled input-sm",
		searchInputOutline: "input-outline input-sm",
		table: "table table-bordered",
		tableContainer: "table-responsive",
		tableHeading: "fw-bold",
		tableSort: "table-sort",
		tableSortAsc: "table-sort-asc",
		tableSortDesc: "table-sort-desc",
		topRow: "d-md-flex justify-content-between mb-2"
	};
	/** @type {TableOptions} */
	static defaults = {
		buttons: [],
		layout: {
			top: "search,buttons|length",
			bottom: "info,pagination"
		},
		lang: {
			info: "Showing results {start} to {end} of {total}",
			infoFiltered: "Showing results {start} to {end} of {filtered} (filtered from {total} total)",
			noData: "No data available",
			noResults: "No results to show",
			page: "Page",
			perPage: "Per Page",
			search: "Search",
			loading: "Loading results",
			paginate: {
				first: "First",
				last: "Last",
				next: "Next",
				previous: "Previous"
			},
			buttons: {
				csv: "CSV",
				excel: "Excel",
				print: "Print"
			},
			aria: {
				sortAscending: ": activate to sort column ascending",
				sortDescending: ": activate to sort column descending"
			}
		},
		icons: {
			first: "&laquo;",
			last: "&raquo;",
			next: "&gt;",
			previous: "&lt;"
		},
		sanitize: (html) => $.sanitize(html),
		inputStyle: "filled",
		createdRow: null,
		drawCallback: null,
		footerCallback: null,
		headerCallback: null,
		infoCallback: null,
		preDrawCallback: null,
		rowCallback: null,
		columns: null,
		order: [[0, "asc"]],
		lengths: [
			10,
			25,
			50,
			100
		],
		length: 10,
		debounce: 250,
		info: true,
		lengthChange: true,
		ordering: true,
		paging: true,
		searching: true
	};
	static layout = {
		buttons(container) {
			this.#renderButtons(container);
		},
		search(container) {
			this.#renderSearch(container);
		},
		length(container) {
			this.#renderLengthSelect(container);
		},
		info(container) {
			this.#renderInfoContainer(container);
		},
		pagination(container) {
			this.#renderPaginationContainer(container);
		}
	};
	#columns = [];
	#container = null;
	#data = [];
	#drawVersion = 0;
	#filtered = 0;
	#headings = [];
	#id = false;
	#infoContainer = null;
	#lengthSelect = null;
	#limit;
	#loader = null;
	#loadResults = null;
	#offset = 0;
	#order;
	#original = null;
	#originalBusy;
	#originalClass;
	#originalDescription;
	#page;
	#pagination = null;
	#pending = null;
	#requestVersion = 0;
	#results = [];
	#rowIndexes = [];
	#searchHandler = null;
	#searchInput = null;
	#tbody = null;
	#term = "";
	#tfoot = null;
	#theadRow = null;
	#total = 0;
	#totalPages;
	/**
	* Creates a Table.
	* @param {HTMLTableElement} node The input table.
	* @param {TableOptions} [options] The component options.
	*/
	constructor(node, options) {
		if (!$._isElement(node) || !$.is(node, "table")) throw new TypeError("Table must be created on a table element.");
		super(node, options);
		try {
			this.#originalClass = $.getAttribute(node, "class");
			this.#originalDescription = $.getAttribute(node, "aria-describedby");
			this.#originalBusy = $.getAttribute(node, "aria-busy");
			this.#limit = this.options.paging ? normalizePageLength(this.options.length) : Infinity;
			for (const length of this.options.lengths) normalizePageLength(length);
			if (!this.options.getResults) {
				const data = this.options.data ?? getDomData(node);
				validateRows(data);
				this.#data = data.slice();
			}
			const headings = getDomHeadings(node);
			this.#columns = normalizeColumns(this.options.columns, headings);
			this.#headings = headings;
			if (!headings.length) this.#headings = this.#columns.map((column) => ({
				text: column.name ?? String(column.data),
				class: null
			}));
			this.#order = normalizeOrder(this.options.order, this.#columns);
			if (!$.getProperty(node, "id")) {
				$.setProperty(node, "id", generateId("table"));
				this.#id = true;
			}
			if (this.options.getResults) this.#loadResults = $._debounce((version) => this.#fetchResults(version), this.options.debounce);
			this.#render();
			if (!this.node) return;
			this.#events();
			$.triggerEvent(this.node, "init.ui.table");
			if (this.node) this.#load();
		} catch (error) {
			this.dispose();
			throw error;
		}
	}
	/**
	* Adds a row to the data array.
	* @param {Array|object} row The row to add.
	*/
	addRow(row) {
		if (!this.node) return;
		validateRows([row]);
		this.#data.push(Array.isArray(row) ? [...row] : { ...row });
		this.#mutated(1);
	}
	/**
	* Clears all rows from the data array.
	*/
	clear() {
		if (!this.node) return;
		const requestVersion = this.#cancelRequest();
		if (!this.node || requestVersion !== this.#requestVersion) return;
		this.#searchHandler?.cancel();
		this.#data = [];
		this.#results = [];
		this.#rowIndexes = [];
		this.#offset = 0;
		this.#total = 0;
		this.#filtered = 0;
		this.#term = "";
		if (this.#searchInput) $.setValue(this.#searchInput, "");
		this.#refreshResults();
		this.loading({ show: false });
		if (this.node) this.#renderResults();
	}
	/** @inheritdoc */
	dispose() {
		if (!this.node) return;
		const node = this.node;
		this.#drawVersion++;
		this.#searchHandler?.cancel();
		this.#requestVersion++;
		this.#loadResults?.cancel();
		const pending = this.#pending;
		this.#pending = null;
		super.dispose();
		if (this.#id) $.removeAttribute(node, "id");
		for (const [attribute, value] of [
			["class", this.#originalClass],
			["aria-describedby", this.#originalDescription],
			["aria-busy", this.#originalBusy]
		]) {
			if (value === void 0) continue;
			if (value === null) $.removeAttribute(node, attribute);
			else $.setAttribute(node, { [attribute]: value });
		}
		if (this.#container) {
			$.before(this.#container, node);
			$.remove(this.#container);
		}
		if (this.#original) {
			$.empty(node);
			$.append(node, this.#original);
		}
		this.#original = null;
		this.#container = null;
		this.#loader = null;
		this.#theadRow = null;
		this.#tbody = null;
		this.#tfoot = null;
		this.#infoContainer = null;
		this.#pagination = null;
		this.#lengthSelect = null;
		this.#searchInput = null;
		this.#columns = [];
		this.#headings = [];
		this.#data = [];
		this.#results = [];
		this.#rowIndexes = [];
		this.#loadResults = null;
		this.#searchHandler = null;
		try {
			pending?.cancel?.();
		} catch {}
	}
	/**
	* Gets values for a single column.
	* @param {string} key The key to retrieve.
	* @param {object} [options] Options for getting the column.
	* @param {boolean} [options.modified=true] Whether to use modified indexes.
	* @returns {Array} The column values.
	*/
	getColumn(key, { modified = true } = {}) {
		return modified ? this.#rowIndexes.map((rowIndex) => $._getDot(this.#data[rowIndex], `${key}`)) : this.#data.map((row) => $._getDot(row, `${key}`));
	}
	/**
	* Gets values for a single row.
	* @param {number} index The row index to retrieve.
	* @param {object} [options] Options for getting the row index.
	* @param {boolean} [options.modified=true] Whether to use modified indexes.
	* @returns {TableRow} A shallow copy of the row.
	*/
	getRow(index, { modified = true } = {}) {
		const rowIndex = this.#getIndex(index, { modified });
		return $._isPlainObject(this.#data[rowIndex]) ? { ...this.#data[rowIndex] } : [...this.#data[rowIndex]];
	}
	/**
	* Gets a single value from a row.
	* @param {number} index The row index to retrieve.
	* @param {string} key The key to retrieve.
	* @param {object} [options] Options for getting the row index.
	* @param {boolean} [options.modified=true] Whether to use modified indexes.
	* @returns {*} The value.
	*/
	getValue(index, key, { modified = true } = {}) {
		const rowIndex = this.#getIndex(index, { modified });
		return $._getDot(this.#data[rowIndex], `${key}`);
	}
	/**
	* Toggles a column as hidden.
	* @param {number} index The column index.
	*/
	hideColumn(index) {
		validateColumnIndex(index, this.#columns.length);
		this.#columns[index].visible = false;
		this.#renderResults();
	}
	/**
	* Gets the Table information.
	* @returns {object} The Table information.
	*/
	info() {
		return {
			end: this.#offset + this.#results.length,
			filtered: this.#filtered,
			start: this.#offset,
			total: this.#total
		};
	}
	/**
	* Sets the Table length.
	* @param {number} length The length.
	*/
	length(length) {
		if (!this.node || !this.options.paging) return;
		length = normalizePageLength(length);
		this.#limit = length;
		this.#offset -= this.#offset % length;
		this.#syncLength();
		$.triggerEvent(this.node, "length.ui.table");
		if (this.node) this.#load();
	}
	/**
	* Triggers the loading indicator.
	* @param {object} [options] Options for the loading indicator.
	* @param {boolean} [options.show=true] Whether to show the loading indicator.
	*/
	loading({ show = true } = {}) {
		if (!this.node) return;
		$.setAttribute(this.node, { "aria-busy": String(show) });
		if (show) {
			$.show(this.#loader);
			$.triggerEvent(this.node, "processing.ui.table");
		} else {
			$.hide(this.#loader);
			$.triggerEvent(this.node, "processed.ui.table");
		}
	}
	/**
	* Sets the Table order data.
	* @param {Array} order The order data.
	*/
	order(order) {
		if (!this.node || !this.options.ordering) return;
		this.#order = normalizeOrder(order, this.#columns);
		$.triggerEvent(this.node, "order.ui.table");
		if (this.node) this.#load();
	}
	/**
	* Sets the Table page.
	* @param {number} page The one-based page number.
	*/
	page(page) {
		if (!this.node || !this.options.paging) return;
		page = Number(page);
		if (!Number.isSafeInteger(page)) throw new RangeError("Page must be an integer.");
		const pages = Math.max(1, Math.ceil(this.#filtered / this.#limit));
		this.#offset = (Math.min(pages, Math.max(1, page)) - 1) * this.#limit;
		$.triggerEvent(this.node, "page.ui.table");
		if (this.node) this.#load();
	}
	/**
	* Redraws the Table.
	*/
	refresh() {
		this.#renderResults();
	}
	/**
	* Reloads the Table data.
	* @param {object} [options] Options for reloading the data
	* @param {boolean} [options.reset=false] Whether to reset the offset.
	*/
	reload({ reset = false } = {}) {
		if (!this.node) return;
		if (reset) this.#offset = 0;
		this.#load();
	}
	/**
	* Removes a row from the data array.
	* @param {number} index The row index to remove.
	* @param {object} [options] Options for getting the row index.
	* @param {boolean} [options.modified=true] Whether to use modified indexes.
	*/
	removeRow(index, { modified = true } = {}) {
		const rowIndex = this.#getIndex(index, { modified });
		this.#data.splice(rowIndex, 1);
		this.#mutated(-1);
	}
	/**
	* Searches the Table for a term.
	* @param {string} term The term to search for.
	*/
	search(term) {
		if (!this.node || !this.options.searching) return;
		this.#searchHandler?.cancel();
		this.#term = String(term ?? "");
		this.#offset = 0;
		if (this.#searchInput) $.setValue(this.#searchInput, this.#term);
		$.triggerEvent(this.node, "search.ui.table");
		if (this.node) this.#load();
	}
	/**
	* Sets values for a single column.
	* @param {string} key The key to set.
	* @param {Array} column The column values.
	* @param {object} [options] Options for getting the row index.
	* @param {boolean} [options.modified=true] Whether to use modified indexes.
	*/
	setColumn(key, column, { modified = true } = {}) {
		const indexes = modified ? this.#rowIndexes : this.#data.map((_, index) => index);
		if (!Array.isArray(column) || column.length !== indexes.length) throw new RangeError("Column values must match the selected row count.");
		for (const [index, rowIndex] of indexes.entries()) $._setDot(this.#data[rowIndex], String(key), column[index]);
		this.#mutated();
	}
	/**
	* Sets values for a single row.
	* @param {number} index The row index to set.
	* @param {Array|object} row The row values.
	* @param {object} [options] Options for getting the row index.
	* @param {boolean} [options.modified=true] Whether to use modified indexes.
	*/
	setRow(index, row, { modified = true } = {}) {
		const rowIndex = this.#getIndex(index, { modified });
		validateRows([row]);
		this.#data[rowIndex] = Array.isArray(row) ? [...row] : { ...row };
		this.#mutated();
	}
	/**
	* Sets a single value for a row.
	* @param {number} index The row index to set.
	* @param {string} key The key to set.
	* @param {*} value The value to set.
	* @param {object} [options] Options for getting the row index.
	* @param {boolean} [options.modified=true] Whether to use modified indexes.
	*/
	setValue(index, key, value, { modified = true } = {}) {
		const rowIndex = this.#getIndex(index, { modified });
		$._setDot(this.#data[rowIndex], String(key), value);
		this.#mutated();
	}
	/**
	* Toggles a column as visible.
	* @param {number} index The column index.
	*/
	showColumn(index) {
		validateColumnIndex(index, this.#columns.length);
		this.#columns[index].visible = true;
		this.#renderResults();
	}
	/**
	* Invalidates pending results before invoking an optional cancellation hook.
	* @returns {number} The invalidation generation.
	*/
	#cancelRequest() {
		const version = ++this.#requestVersion;
		this.#loadResults?.cancel();
		const pending = this.#pending;
		this.#pending = null;
		try {
			pending?.cancel?.();
		} catch {}
		return version;
	}
	/**
	* Attaches events for the Table.
	*/
	#events() {
		if (this.#lengthSelect) $.addEvent(this.#lengthSelect, "change.ui.table", () => {
			const length = $.getValue(this.#lengthSelect);
			this.length(length);
		});
		if (this.#searchInput) {
			this.#searchHandler = $._debounce(() => {
				if (this.node) this.search($.getValue(this.#searchInput));
			}, this.options.getResults ? 0 : this.options.debounce);
			$.addEvent(this.#searchInput, "input.ui.table", this.#searchHandler);
		}
		if (this.options.ordering) {
			const handleSort = (event) => {
				const index = Number($.getDataset(event.currentTarget, "uiIndex"));
				if (!this.#columns[index].orderable) return;
				event.preventDefault();
				const defaultDir = this.#columns[index].dir;
				const currentDir = this.#order.find(([column]) => column === index)?.[1];
				let nextDir = defaultDir;
				if (currentDir === defaultDir) nextDir = defaultDir === "asc" ? "desc" : "asc";
				let order;
				if (event.shiftKey) {
					if (!currentDir) order = [...this.#order, [index, nextDir]];
					else if (currentDir === defaultDir) order = this.#order.map(([column, direction]) => [column, column === index ? nextDir : direction]);
					else order = this.#order.filter(([column]) => column !== index);
				} else order = [[index, nextDir]];
				this.order(order);
			};
			$.addEventDelegate(this.#theadRow, "click.ui.table", "th", handleSort);
			$.addEventDelegate(this.#theadRow, "keydown.ui.table", "th", (event) => {
				switch (event.code) {
					case "Enter":
					case "NumpadEnter":
					case "Space": handleSort(event);
				}
			});
		}
		if (this.#pagination) $.addEventDelegate(this.#pagination, "click.ui.table", "[data-ui-page]", (event) => {
			event.preventDefault();
			if ($.getProperty(event.currentTarget, "disabled")) return;
			let page = $.getDataset(event.currentTarget, "uiPage");
			switch (page) {
				case "first":
					page = 1;
					break;
				case "prev":
					page = this.#page - 1;
					break;
				case "next":
					page = this.#page + 1;
					break;
				case "last": page = this.#totalPages;
			}
			this.page(page);
		});
	}
	/**
	* Loads and validates the newest remote page.
	* @param {number} version The request generation.
	* @returns {Promise<void>} Completion of the request.
	*/
	async #fetchResults(version) {
		const active = () => this.node && version === this.#requestVersion;
		if (!active()) return;
		const request = { columns: {} };
		for (const [index, column] of this.#columns.entries()) {
			request.columns[index] = {
				data: column.data,
				orderable: column.orderable,
				searchable: column.searchable
			};
			if (column.name) request.columns[index].name = column.name;
		}
		if (this.#term) request.term = this.#term;
		if (this.options.ordering) request.order = { ...this.#getOrder().map(([column, dir]) => ({
			column,
			dir
		})) };
		if (this.options.paging) {
			request.offset = this.#offset;
			request.limit = this.#limit;
		}
		let response;
		try {
			const pending = this.options.getResults.call(this, request);
			if (!active()) {
				Promise.resolve(pending).catch(() => {});
				pending?.cancel?.();
				return;
			}
			this.#pending = pending;
			response = await pending;
			if (!active()) return;
			validateRows(response?.results);
			if (!Number.isSafeInteger(response.total) || !Number.isSafeInteger(response.filtered) || response.total < 0 || response.filtered < 0 || response.filtered > response.total || response.results.length > response.filtered || this.options.paging && response.results.length > this.#limit) throw new TypeError("Remote counts and rows must describe a valid result page.");
		} catch (error) {
			if (active()) {
				this.#pending = null;
				this.loading({ show: false });
				if (active()) $.triggerEvent(this.node, "error.ui.table", { detail: { error } });
			}
			return;
		}
		this.#pending = null;
		this.#total = response.total;
		this.#filtered = response.filtered;
		if (this.options.paging && this.#offset >= this.#filtered && this.#offset > 0) {
			this.#offset = Math.max(0, (Math.ceil(this.#filtered / this.#limit) - 1) * this.#limit);
			this.#load();
			return;
		}
		this.#data = response.results.slice();
		this.#refreshResults();
		this.loading({ show: false });
		if (active()) this.#renderResults();
	}
	/**
	* Copies the headings and displayed rows required by an export button.
	* @param {TableButton} options The export button options.
	* @returns {{headings: string[], rows: Array<Array<*>>}} The export data.
	*/
	#getExportData(options) {
		const columns = options.columns || this.#getVisibleColumns();
		for (const index of columns) validateColumnIndex(index, this.#columns.length);
		return {
			headings: columns.map((index) => {
				const container = $.create("div");
				$.setHtml(container, $.sanitize(String(this.#headings[index].text)));
				return $.getText(container);
			}),
			rows: this.#results.map((row) => columns.map((index) => {
				const key = String(this.#columns[index].data);
				return $._getDot(row, key);
			}))
		};
	}
	/**
	* Gets an index (optionally modified).
	* @param {number} index The index to get.
	* @param {object} [options] Options for getting the row index.
	* @param {boolean} [options.modified=true] Whether to use modified indexes.
	* @returns {number} The index.
	*/
	#getIndex(index, { modified = true } = {}) {
		const count = modified ? this.#rowIndexes.length : this.#data.length;
		if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError("Row index is out of range.");
		return modified ? this.#rowIndexes[index] : index;
	}
	/**
	* Expands alternate sort columns, which were validated during initialization.
	* @returns {Array} The column ordering data.
	*/
	#getOrder() {
		return this.#order.flatMap(([index, direction]) => {
			return (this.#columns[index].orderData ?? [index]).map((column) => [column, direction]);
		});
	}
	/**
	* Gets the visible columns.
	* @returns {Array} The visible columns.
	*/
	#getVisibleColumns() {
		const columns = [];
		for (const [index, column] of this.#columns.entries()) {
			if (!column.visible) continue;
			columns.push(index);
		}
		return columns;
	}
	/**
	* Loads the current page from local data or schedules a remote request.
	*/
	#load() {
		if (!this.node) return;
		const drawVersion = ++this.#drawVersion;
		if (this.options.getResults) {
			const requestVersion = this.#cancelRequest();
			if (!this.node || requestVersion !== this.#requestVersion) return;
			this.loading();
			if (this.node && requestVersion === this.#requestVersion) this.#loadResults(requestVersion);
			return;
		}
		this.loading();
		if (!this.node || drawVersion !== this.#drawVersion) return;
		this.#updateLocal();
		this.loading({ show: false });
		if (this.node && drawVersion === this.#drawVersion) this.#renderResults();
	}
	/**
	* Redraws after a row mutation; remote mutations affect the loaded page only.
	* @param {number} [change=0] The change in the remote row count.
	*/
	#mutated(change = 0) {
		if (!this.node) return;
		if (!this.options.getResults) {
			this.#load();
			return;
		}
		const version = this.#cancelRequest();
		if (!this.node || version !== this.#requestVersion) return;
		this.#total = Math.max(0, this.#total + change);
		this.#filtered = Math.max(0, this.#filtered + change);
		if (!this.#data.length && this.#offset) {
			this.#offset = Math.max(0, this.#offset - this.#limit);
			this.#load();
			return;
		}
		this.#refreshResults();
		this.loading({ show: false });
		if (this.node) this.#renderResults();
	}
	/**
	* Refreshes the results.
	*/
	#refreshResults() {
		this.#page = this.options.paging ? 1 + this.#offset / this.#limit : 1;
		this.#totalPages = this.options.paging ? Math.max(1, Math.ceil(this.#filtered / this.#limit)) : 1;
		if (this.options.getResults) this.#rowIndexes = this.#data.map((_, index) => index);
		this.#results = this.#rowIndexes.map((index) => this.#data[index]);
	}
	/**
	* Renders the Table.
	*/
	#render() {
		this.#original = $.createFragment();
		$.append(this.#original, $.contents(this.node));
		this.#container = $.create("div", { class: this.constructor.classes.container });
		this.#loader = $.create("div", {
			class: this.constructor.classes.loader,
			attributes: {
				"role": "progressbar",
				"aria-label": this.options.lang.loading
			}
		});
		const loaderIcon = $.create("span", { class: this.constructor.classes.loaderIcon });
		$.append(this.#loader, loaderIcon);
		$.addClass(this.node, this.constructor.classes.table);
		const caption = $.findOne("caption", this.#original);
		if (caption) $.append(this.node, $.clone(caption));
		const thead = $.create("thead");
		$.append(this.node, thead);
		this.#theadRow = $.create("tr");
		$.append(thead, this.#theadRow);
		this.#tbody = $.create("tbody");
		$.append(this.node, this.#tbody);
		const tfoot = $.findOne("tfoot", this.#original);
		if (tfoot) {
			this.#tfoot = $.clone(tfoot)[0];
			$.append(this.node, this.#tfoot);
		}
		$.hide(this.#loader);
		$.after(this.node, this.#container);
		$.append(this.#container, this.#loader);
		if (this.options.layout.top) {
			this.#renderLayoutRow(this.options.layout.top, this.constructor.classes.topRow);
			if (!this.node) return;
		}
		const tableContainer = $.create("div", { class: this.constructor.classes.tableContainer });
		$.append(tableContainer, this.node);
		$.append(this.#container, tableContainer);
		if (this.options.layout.bottom) {
			this.#renderLayoutRow(this.options.layout.bottom, this.constructor.classes.bottomRow);
			if (!this.node) return;
		}
		if (this.#infoContainer) {
			const descriptions = [this.#originalDescription, $.getProperty(this.#infoContainer, "id")];
			$.setAttribute(this.node, { "aria-describedby": descriptions.filter(Boolean).join(" ") });
		}
	}
	/**
	* Renders the table buttons.
	* @param {HTMLElement} container The container to render in.
	*/
	#renderButtons(container) {
		const btnGroup = $.create("div", { class: this.constructor.classes.buttonGroup });
		for (const button of this.options.buttons) {
			const btn = $.create("button", {
				class: this.constructor.classes.button,
				text: !button.text && button.type in this.options.lang.buttons ? this.options.lang.buttons[button.type] : button.text,
				attributes: {
					"type": "button",
					"aria-controls": $.getAttribute(this.node, "id")
				}
			});
			$.addEvent(btn, "click.ui.table", (event) => {
				event.preventDefault();
				if (button.callback) button.callback.call(this);
				else if (Object.hasOwn(this.constructor.buttons, button.type)) this.constructor.buttons[button.type].call(this, button);
			});
			$.append(btnGroup, btn);
		}
		$.append(container, btnGroup);
	}
	/**
	* Renders the table headings.
	*/
	#renderHeadings() {
		const version = this.#drawVersion;
		const children = $.children(this.#theadRow);
		const headings = {};
		for (const child of children) {
			const index = $.getDataset(child, "uiIndex");
			if (!this.#columns[index].visible) $.detach(child);
			else headings[index] = child;
		}
		let lastCell;
		for (const [index, heading] of this.#headings.entries()) {
			if (!this.#columns[index].visible) continue;
			let cell;
			if (index in headings) cell = headings[index];
			else {
				const html = this.options.sanitize(String(heading.text));
				if (!this.node || version !== this.#drawVersion) return;
				cell = $.create("th", {
					class: this.constructor.classes.tableHeading,
					html,
					dataset: { uiIndex: index }
				});
				if (heading.class) $.addClass(cell, heading.class);
				if (this.options.ordering && this.#columns[index].orderable) {
					$.addClass(cell, this.constructor.classes.tableSort);
					$.setAttribute(cell, {
						"tabindex": 0,
						"aria-controls": $.getAttribute(this.node, "id")
					});
				}
				if (!this.node) return;
				if (!lastCell) $.prepend(this.#theadRow, cell);
				else $.insertAfter(cell, lastCell);
			}
			lastCell = cell;
			if (!this.options.ordering || !this.#columns[index].orderable) continue;
			const dir = this.#order.find(([column]) => column === index)?.[1];
			switch (dir) {
				case "asc":
					$.addClass(cell, this.constructor.classes.tableSortAsc);
					$.removeClass(cell, this.constructor.classes.tableSortDesc);
					$.setAttribute(cell, { "aria-sort": "ascending" });
					break;
				case "desc":
					$.addClass(cell, this.constructor.classes.tableSortDesc);
					$.removeClass(cell, this.constructor.classes.tableSortAsc);
					$.setAttribute(cell, { "aria-sort": "descending" });
					break;
				default:
					$.removeClass(cell, [this.constructor.classes.tableSortAsc, this.constructor.classes.tableSortDesc]);
					$.removeAttribute(cell, "aria-sort");
			}
			const text = $.getText(cell);
			if (dir === "asc" || !dir && this.#columns[index].dir === "desc") $.setAttribute(cell, { "aria-label": `${text}${this.options.lang.aria.sortDescending}` });
			else $.setAttribute(cell, { "aria-label": `${text}${this.options.lang.aria.sortAscending}` });
		}
	}
	/**
	* Renders the table info.
	*/
	#renderInfo() {
		const version = this.#drawVersion;
		$.empty(this.#infoContainer);
		const start = this.#results.length ? this.#offset + 1 : 0;
		const end = this.#offset + this.#results.length;
		let infoText = this.#filtered < this.#total ? this.options.lang.infoFiltered : this.options.lang.info;
		const replacements = {
			start,
			end,
			filtered: this.#filtered,
			total: this.#total
		};
		for (const [key, value] of Object.entries(replacements)) infoText = infoText.replace(`{${key}}`, value);
		if (this.options.infoCallback) infoText = this.options.infoCallback.call(this, start, end, this.#total, this.#filtered, infoText);
		if (!this.node || version !== this.#drawVersion) return;
		const text = $.create("small", { text: infoText });
		$.append(this.#infoContainer, text);
	}
	/**
	* Renders the table info container in a container.
	* @param {HTMLElement} container The container to render in.
	*/
	#renderInfoContainer(container) {
		if (!this.options.info) return;
		const id = generateId("table-info");
		this.#infoContainer = $.create("div", {
			class: this.constructor.classes.infoContainer,
			attributes: {
				id,
				"role": "status",
				"aria-live": "polite"
			}
		});
		$.append(container, this.#infoContainer);
	}
	/**
	* Renders a layout row in a container.
	* @param {Array} columns The columns to render.
	* @param {string} rowClass The row class.
	*/
	#renderLayoutRow(columns, rowClass) {
		const row = $.create("div", { class: rowClass });
		for (const elements of columns.split(",")) {
			const column = $.create("div", { class: this.constructor.classes.column });
			for (const element of elements.split("|")) {
				if (!Object.hasOwn(this.constructor.layout, element)) continue;
				const container = $.create("div", { class: this.constructor.classes.columnContainer });
				this.constructor.layout[element].call(this, container);
				if (!this.node) return;
				$.append(column, container);
			}
			$.append(row, column);
		}
		$.append(this.#container, row);
	}
	/**
	* Renders the length select in a container.
	* @param {HTMLElement} container The container to render in.
	*/
	#renderLengthSelect(container) {
		if (!this.options.lengthChange || !this.options.paging) return;
		const lengthContainer = $.create("div", { class: this.constructor.classes.lengthContainer });
		const label = $.create("label", { class: this.constructor.classes.lengthLabel });
		$.append(lengthContainer, label);
		const labelText = $.create("small", {
			class: this.constructor.classes.lengthLabelText,
			text: this.options.lang.perPage
		});
		$.append(label, labelText);
		const inputContainer = $.create("div", {
			class: this.constructor.classes.lengthInputContainer,
			style: { width: "initial" }
		});
		$.append(label, inputContainer);
		this.#lengthSelect = $.create("select", {
			class: this.options.inputStyle === "filled" ? this.constructor.classes.lengthInputFilled : this.constructor.classes.lengthInputOutline,
			attributes: { "aria-controls": $.getAttribute(this.node, "id") }
		});
		$.append(inputContainer, this.#lengthSelect);
		for (const length of this.options.lengths) {
			const option = $.create("option", {
				value: length,
				text: length
			});
			$.append(this.#lengthSelect, option);
		}
		this.#syncLength();
		$.append(container, lengthContainer);
	}
	/**
	* Renders a pagination item.
	* @param {object} options Options for rendering the pagnination item.
	* @returns {HTMLElement} The pagnination item.
	*/
	#renderPageItem(options) {
		const label = options.text ? `${options.text} ${this.options.lang.page}` : `${this.options.lang.page} ${options.page}`;
		const container = $.create("div", { class: this.constructor.classes.pageItem });
		const link = $.create("button", {
			html: options.icon || options.text || options.page,
			class: this.constructor.classes.pageLink,
			attributes: {
				"type": "button",
				"title": label,
				"aria-label": label,
				"aria-controls": $.getAttribute(this.node, "id")
			},
			dataset: { uiPage: options.page }
		});
		$.append(container, link);
		return container;
	}
	/**
	* Renders the pagination.
	*/
	#renderPagination() {
		const setDisabled = (container, disabled) => {
			const link = $.findOne(":scope > [data-ui-page]", container);
			$.setProperty(link, { disabled });
			if (disabled) {
				$.addClass(container, this.constructor.classes.pageDisabled);
				$.setAttribute(link, {
					"aria-disabled": true,
					"tabindex": -1
				});
			} else {
				$.removeClass(container, this.constructor.classes.pageDisabled);
				$.removeAttribute(link, "aria-disabled");
				$.removeAttribute(link, "tabindex");
			}
		};
		const children = $.children(this.#pagination);
		let firstPage;
		let prevPage;
		let nextPage;
		let lastPage;
		if (children.length) {
			firstPage = children.shift();
			prevPage = children.shift();
			lastPage = children.pop();
			nextPage = children.pop();
		} else {
			firstPage = this.#renderPageItem({
				text: this.options.lang.paginate.first,
				icon: this.options.icons.first,
				page: "first"
			});
			$.append(this.#pagination, firstPage);
			prevPage = this.#renderPageItem({
				text: this.options.lang.paginate.previous,
				icon: this.options.icons.previous,
				page: "prev"
			});
			$.append(this.#pagination, prevPage);
			nextPage = this.#renderPageItem({
				text: this.options.lang.paginate.next,
				icon: this.options.icons.next,
				page: "next"
			});
			$.append(this.#pagination, nextPage);
			lastPage = this.#renderPageItem({
				text: this.options.lang.paginate.last,
				icon: this.options.icons.last,
				page: "last"
			});
			$.append(this.#pagination, lastPage);
		}
		setDisabled(firstPage, this.#page === 1);
		setDisabled(prevPage, this.#page === 1);
		setDisabled(nextPage, this.#page === this.#totalPages);
		setDisabled(lastPage, this.#page === this.#totalPages);
		let startPage = Math.max(this.#page - 5, 1);
		let endPage = Math.min(this.#page + 5, this.#totalPages);
		while (endPage - startPage > 4) if (this.#page - startPage > endPage - this.#page) startPage++;
		else endPage--;
		const pageLinks = {};
		for (const child of children) {
			const link = $.findOne(":scope > [data-ui-page]", child);
			const page = $.getDataset(link, "uiPage");
			if (page < startPage || page > endPage) $.detach(child);
			else pageLinks[page] = child;
		}
		let lastLink = prevPage;
		for (let current = startPage; current <= endPage; current++) {
			let pageItem;
			if (current in pageLinks) pageItem = pageLinks[current];
			else {
				pageItem = this.#renderPageItem({ page: current });
				$.insertAfter(pageItem, lastLink);
			}
			const pageButton = $.findOne("button", pageItem);
			if (current === this.#page) {
				$.setAttribute(pageButton, { "aria-current": "page" });
				$.addClass(pageItem, this.constructor.classes.pageActive);
			} else {
				$.removeAttribute(pageButton, "aria-current");
				$.removeClass(pageItem, this.constructor.classes.pageActive);
			}
			lastLink = pageItem;
		}
	}
	/**
	* Renders the pagination container in a container.
	* @param {HTMLElement} container The container to render in.
	*/
	#renderPaginationContainer(container) {
		if (!this.options.paging) return;
		const paginationContainer = $.create("div", { class: this.constructor.classes.paginationContainer });
		$.append(container, paginationContainer);
		this.#pagination = $.create("div", { class: this.constructor.classes.pagination });
		$.append(paginationContainer, this.#pagination);
	}
	/**
	* Renders the table results.
	*/
	#renderResults() {
		if (!this.node) return;
		const version = ++this.#drawVersion;
		const active = () => this.node && version === this.#drawVersion;
		$.triggerEvent(this.node, "preDraw.ui.table");
		if (!active()) return;
		const proceed = this.options.preDrawCallback?.call(this);
		if (!active() || proceed === false) return;
		$.empty(this.#tbody);
		this.#renderHeadings();
		if (!active()) return;
		const end = this.#offset + this.#results.length;
		this.options.headerCallback?.call(this, this.#theadRow, this.#data, this.#offset, end, [...this.#rowIndexes]);
		if (!active()) return;
		if (this.#pagination) this.#renderPagination();
		if (this.#infoContainer) this.#renderInfo();
		if (!active()) return;
		if (!this.#results.length) {
			const row = $.create("tr");
			$.append(row, $.create("td", {
				class: this.constructor.classes.emptyCell,
				text: this.#term ? this.options.lang.noResults : this.options.lang.noData,
				attributes: { colspan: Math.max(1, this.#getVisibleColumns().length) }
			}));
			$.append(this.#tbody, row);
		} else for (const [index, result] of this.#results.entries()) {
			const row = this.#renderRow(result, index);
			if (!active()) return;
			this.options.rowCallback?.call(this, row, result, index, this.#offset + index, this.#rowIndexes[index]);
			if (!active()) return;
			$.append(this.#tbody, row);
			this.options.createdRow?.call(this, row, result, index);
			if (!active()) return;
		}
		this.options.drawCallback?.call(this);
		if (!active()) return;
		if (this.#tfoot) this.options.footerCallback?.call(this, this.#tfoot, this.#data, this.#offset, end, [...this.#rowIndexes]);
		if (active()) $.triggerEvent(this.node, "draw.ui.table");
	}
	/**
	* Renders a result row.
	* @param {Array|object} data The row data.
	* @param {number} rowIndex The row index.
	* @returns {HTMLElement} The table row.
	*/
	#renderRow(data, rowIndex) {
		const row = $.create("tr");
		const version = this.#drawVersion;
		for (const [index, column] of this.#columns.entries()) {
			if (!column.visible) continue;
			const value = $._getDot(data, String(column.data));
			const formatted = column.format ? column.format.call(this, value) : value;
			if (!this.node || version !== this.#drawVersion) return row;
			const html = this.options.sanitize(String(formatted ?? ""));
			if (!this.node || version !== this.#drawVersion) return row;
			const cell = $.create("td", {
				html,
				class: column.class || ""
			});
			column.createdCell?.call(this, cell, value, data, rowIndex, index);
			if (!this.node || version !== this.#drawVersion) return row;
			$.append(row, cell);
		}
		return row;
	}
	/**
	* Renders the search in a container.
	* @param {HTMLElement} container The container to render in.
	*/
	#renderSearch(container) {
		if (!this.options.searching) return;
		const searchContainer = $.create("div", { class: this.constructor.classes.searchContainer });
		const inputContainer = $.create("div", {
			class: this.constructor.classes.searchInputContainer,
			style: { width: "200px" }
		});
		$.append(searchContainer, inputContainer);
		this.#searchInput = $.create("input", {
			class: this.options.inputStyle === "filled" ? this.constructor.classes.searchInputFilled : this.constructor.classes.searchInputOutline,
			attributes: {
				"type": "search",
				"placeholder": this.options.lang.search,
				"aria-label": this.options.lang.search,
				"aria-controls": $.getAttribute(this.node, "id")
			}
		});
		$.append(inputContainer, this.#searchInput);
		$.append(container, searchContainer);
	}
	/**
	* Selects the current length, including a programmatically requested length.
	*/
	#syncLength() {
		if (!this.#lengthSelect) return;
		if (!$.children(this.#lengthSelect, "option").some((option) => Number($.getValue(option)) === this.#limit)) {
			const option = $.create("option", {
				value: this.#limit,
				text: this.#limit
			});
			$.append(this.#lengthSelect, option);
		}
		$.setValue(this.#lengthSelect, this.#limit);
	}
	/**
	* Recomputes local matching, stable ordering, counts, and the current page.
	*/
	#updateLocal() {
		this.#total = this.#data.length;
		const term = this.#term.toLocaleLowerCase();
		let indexes = this.#data.map((_, index) => index);
		if (term) indexes = indexes.filter((index) => this.#columns.some((column) => {
			if (!column.searchable) return false;
			const value = $._getDot(this.#data[index], String(column.data));
			return String(value ?? "").toLocaleLowerCase().includes(term);
		}));
		this.#filtered = indexes.length;
		const order = this.options.ordering ? this.#getOrder() : [];
		indexes.sort((a, b) => {
			for (const [index, direction] of order) {
				const key = String(this.#columns[index].data);
				const aValue = $._getDot(this.#data[a], key);
				const bValue = $._getDot(this.#data[b], key);
				let difference;
				if ($._isNumeric(aValue) && $._isNumeric(bValue)) difference = Number(aValue) - Number(bValue);
				else {
					const aText = String(aValue ?? "").toLocaleLowerCase();
					const bText = String(bValue ?? "").toLocaleLowerCase();
					difference = aText.localeCompare(bText);
				}
				if (difference) return direction === "desc" ? -difference : difference;
			}
			return a - b;
		});
		if (this.options.paging) {
			const lastOffset = Math.max(0, (Math.ceil(indexes.length / this.#limit) - 1) * this.#limit);
			this.#offset = Math.min(this.#offset, lastOffset);
			indexes = indexes.slice(this.#offset, this.#offset + this.#limit);
		} else this.#offset = 0;
		this.#rowIndexes = indexes;
		this.#refreshResults();
	}
};

//#endregion
//#region src/js/index.js
initComponent("table", Table);
var js_default = Table;

//#endregion
export { js_default as default };
//# sourceMappingURL=frost-ui-tables.esm.js.map