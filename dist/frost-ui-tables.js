(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?  factory(exports, require('@fr0st/ui'), require('@fr0st/query')) :
  typeof define === 'function' && define.amd ? define(['exports', '@fr0st/ui', '@fr0st/query'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.UI = global.UI || {}), global.UI,global.fQuery));
})(this, function(exports, _fr0st_ui, _fr0st_query) {
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region \0rolldown/runtime.js
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) {
					__defProp(to, key, {
						get: ((k) => from[k]).bind(null, key),
						enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
					});
				}
			}
		}
		return to;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));

//#endregion
_fr0st_query = __toESM(_fr0st_query, 1);

//#region src/js/helpers.js
/**
	* Builds a data array from a DOM element.
	* @param {HTMLElement} element The element to parse.
	* @returns {Array} The parsed data.
	*/
	function getDomData(element) {
		const tbody = _fr0st_query.default.findOne("tbody", element);
		return _fr0st_query.default.children(tbody, "tr").map((row) => _fr0st_query.default.children(row, "td").map((cell) => _fr0st_query.default.getHtml(cell)));
	}
	/**
	* Builds a heading array from a DOM element.
	* @param {HTMLElement} element The element to parse.
	* @returns {Array} The parsed data.
	*/
	function getDomHeadings(element) {
		const thead = element.tHead;
		if (!thead) return [];
		if (thead.rows.length > 1 || _fr0st_query.default.find("th", thead).some((cell) => cell.colSpan !== 1 || cell.rowSpan !== 1)) throw new RangeError("Table supports one heading row without spanning cells.");
		const row = thead.rows[0];
		return _fr0st_query.default.children(row, "th").map((cell) => ({
			text: _fr0st_query.default.getHtml(cell),
			class: _fr0st_query.default.getAttribute(cell, "class")
		}));
	}
	/**
	* Downloads a blob.
	* @param {Blob} blob The blob to save.
	* @param {string} filename The filename.
	*/
	function saveBlob(blob, filename) {
		const url = URL.createObjectURL(blob);
		const link = _fr0st_query.default.create("a", { attributes: {
			href: url,
			download: filename
		} });
		try {
			_fr0st_query.default.append(document.body, link);
			_fr0st_query.default.click(link);
		} finally {
			_fr0st_query.default.detach(link);
			setTimeout(() => URL.revokeObjectURL(url), 0);
		}
	}

//#endregion
//#region src/js/zip/crc32.js
	var table = null;
	/**
	* Generate the CRC32 table.
	* @returns {Uint32Array} The CRC32 table.
	*/
	var generateTable = () => {
		if (!table) {
			table = /* @__PURE__ */ new Uint32Array(256);
			for (let i = 0; i < 256; i++) {
				let c = i;
				for (let j = 0; j < 8; j++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
				table[i] = c >>> 0;
			}
		}
		return table;
	};
	/**
	* CRC32 Class
	* Based on https://github.com/imaya/zlib.js/blob/develop/src/crc32.js
	* @class
	*/
	var CRC32 = class {
		/**
		* Gets the CRC32 hash value.
		* @param {Uint8Array} data The data to hash.
		* @param {number} [pos] The data position.
		* @param {number} [length] The data length.
		* @returns {number} The CRC32 hash.
		*/
		static calc(data, pos = 0, length = null) {
			return this.update(data, 0, pos, length);
		}
		/**
		* Updates the CRC32 hash value.
		* @param {Uint8Array} data The data to hash.
		* @param {number} crc The CRC32 hash.
		* @param {number} [pos] The data position.
		* @param {number} [length] The data length.
		* @returns {number} The CRC32 hash.
		*/
		static update(data, crc, pos = 0, length = null) {
			if (length === null) length = data.length;
			crc ^= 4294967295;
			const table = generateTable();
			for (let i = length & 7; i--; ++pos) crc = crc >>> 8 ^ table[(crc ^ data[pos]) & 255];
			for (let i = length >> 3; i--; pos += 8) {
				crc = crc >>> 8 ^ table[(crc ^ data[pos]) & 255];
				crc = crc >>> 8 ^ table[(crc ^ data[pos + 1]) & 255];
				crc = crc >>> 8 ^ table[(crc ^ data[pos + 2]) & 255];
				crc = crc >>> 8 ^ table[(crc ^ data[pos + 3]) & 255];
				crc = crc >>> 8 ^ table[(crc ^ data[pos + 4]) & 255];
				crc = crc >>> 8 ^ table[(crc ^ data[pos + 5]) & 255];
				crc = crc >>> 8 ^ table[(crc ^ data[pos + 6]) & 255];
				crc = crc >>> 8 ^ table[(crc ^ data[pos + 7]) & 255];
			}
			return (crc ^ 4294967295) >>> 0;
		}
	};

//#endregion
//#region src/js/zip/bit-stream.js
	var reverseTable = null;
	/**
	* Generate the reverse table.
	* @returns {Uint8Array} The reverse table.
	*/
	var buildReverseTable = () => {
		if (reverseTable === null) {
			reverseTable = /* @__PURE__ */ new Uint8Array(256);
			for (let i = 0; i < 256; ++i) {
				let n = i;
				let r = n;
				let s = 7;
				for (n >>>= 1; n; n >>>= 1) {
					r <<= 1;
					r |= n & 1;
					--s;
				}
				reverseTable[i] = (r << s & 255) >>> 0;
			}
		}
		return reverseTable;
	};
	/**
	* Reverse the bit order.
	* @param {number} n The number to reverse.
	* @returns {number} The reversed number.
	*/
	var rev = (n) => {
		return buildReverseTable()[n];
	};
	/**
	* Reverse the bit order (32-bit).
	* @param {number} n The number to reverse.
	* @returns {number} The reversed number.
	*/
	var rev32 = (n) => {
		const reverseTable = buildReverseTable();
		return reverseTable[n & 255] << 24 | reverseTable[n >>> 8 & 255] << 16 | reverseTable[n >>> 16 & 255] << 8 | reverseTable[n >>> 24 & 255];
	};
	/**
	* BitStream Class
	* Based on https://github.com/imaya/zlib.js/blob/develop/src/bitstream.js
	* @class
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
			if (reverse && n > 1) number = n > 8 ? rev32(number) >> 32 - n : rev(number) >> 8 - n;
			let current = this.#buffer[this.#index];
			if (n + this.#bitIndex < 8) {
				current = current << n | number;
				this.#bitIndex += n;
			} else for (let i = 0; i < n; i++) {
				current = current << 1 | number >> n - i - 1 & 1;
				if (++this.#bitIndex === 8) {
					this.#bitIndex = 0;
					this.#buffer[this.#index++] = rev(current);
					current = 0;
					if (this.#index === this.#buffer.length) this.#expandBuffer();
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
	};

//#endregion
//#region src/js/zip/heap.js
/**
	* Gets index of parent node.
	* @param {number} index The index.
	* @returns {number} The parent index.
	*/
	var getParent = (index) => {
		return ((index - 2) / 4 | 0) * 2;
	};
	/**
	* Gets index of child node.
	* @param {number} index The index.
	* @returns {number} The child index.
	*/
	var getChild = (index) => {
		return 2 * index + 2;
	};
	/**
	* Heap Class
	* Based on https://github.com/imaya/zlib.js/blob/develop/src/heap.js
	* @class
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
				let current = getChild(parent);
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
				const parent = getParent(current);
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
//#region src/js/zip/lz77-match.js
	var lengthCodeTable = null;
	/**
	* Generate the length codes.
	* @param {number} length The length.
	* @returns {Array} The LZ77 length codes.
	*/
	var generateLengthCodes = (length) => {
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
	};
	/**
	* Generate the length code table.
	* @returns {Array} The length code table.
	*/
	var generateLengthTable = () => {
		if (!lengthCodeTable) {
			lengthCodeTable = [];
			for (let i = 3; i <= 258; i++) {
				const c = generateLengthCodes(i);
				lengthCodeTable[i] = c[2] << 24 | c[1] << 16 | c[0];
			}
		}
		return lengthCodeTable;
	};
	/**
	* Gets the distance code.
	* @param {number} dist The distance.
	* @returns {Array} The distance code.
	*/
	var getDistanceCode = (dist) => {
		switch (true) {
			case dist === 1: return [
				0,
				dist - 1,
				0
			];
			case dist === 2: return [
				1,
				dist - 2,
				0
			];
			case dist === 3: return [
				2,
				dist - 3,
				0
			];
			case dist === 4: return [
				3,
				dist - 4,
				0
			];
			case dist <= 6: return [
				4,
				dist - 5,
				1
			];
			case dist <= 8: return [
				5,
				dist - 7,
				1
			];
			case dist <= 12: return [
				6,
				dist - 9,
				2
			];
			case dist <= 16: return [
				7,
				dist - 13,
				2
			];
			case dist <= 24: return [
				8,
				dist - 17,
				3
			];
			case dist <= 32: return [
				9,
				dist - 25,
				3
			];
			case dist <= 48: return [
				10,
				dist - 33,
				4
			];
			case dist <= 64: return [
				11,
				dist - 49,
				4
			];
			case dist <= 96: return [
				12,
				dist - 65,
				5
			];
			case dist <= 128: return [
				13,
				dist - 97,
				5
			];
			case dist <= 192: return [
				14,
				dist - 129,
				6
			];
			case dist <= 256: return [
				15,
				dist - 193,
				6
			];
			case dist <= 384: return [
				16,
				dist - 257,
				7
			];
			case dist <= 512: return [
				17,
				dist - 385,
				7
			];
			case dist <= 768: return [
				18,
				dist - 513,
				8
			];
			case dist <= 1024: return [
				19,
				dist - 769,
				8
			];
			case dist <= 1536: return [
				20,
				dist - 1025,
				9
			];
			case dist <= 2048: return [
				21,
				dist - 1537,
				9
			];
			case dist <= 3072: return [
				22,
				dist - 2049,
				10
			];
			case dist <= 4096: return [
				23,
				dist - 3073,
				10
			];
			case dist <= 6144: return [
				24,
				dist - 4097,
				11
			];
			case dist <= 8192: return [
				25,
				dist - 6145,
				11
			];
			case dist <= 12288: return [
				26,
				dist - 8193,
				12
			];
			case dist <= 16384: return [
				27,
				dist - 12289,
				12
			];
			case dist <= 24576: return [
				28,
				dist - 16385,
				13
			];
			case dist <= 32768: return [
				29,
				dist - 24577,
				13
			];
		}
	};
	/**
	* Gets the length code.
	* @param {number} length The length.
	* @returns {number} The length code.
	*/
	var getLengthCode = (length) => {
		return generateLengthTable()[length];
	};
	/**
	* Lz77Match Class
	* Based on https://github.com/imaya/zlib.js/blob/develop/src/rawdeflate.js
	* @class
	*/
	var Lz77Match = class {
		#backwardDistance;
		#length;
		/**
		* Creates a Lz77Match.
		* @param {number} length The length of the match.
		* @param {number} backwardDistance The distanch to match position.
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
			const codeArray = [];
			let pos = 0;
			const lengthCode = getLengthCode(this.#length);
			codeArray[pos++] = lengthCode & 65535;
			codeArray[pos++] = lengthCode >> 16 & 255;
			codeArray[pos++] = lengthCode >> 24;
			const distCode = getDistanceCode(this.#backwardDistance);
			codeArray[pos++] = distCode[0];
			codeArray[pos++] = distCode[1];
			codeArray[pos] = distCode[2];
			return codeArray;
		}
	};

//#endregion
//#region src/js/zip/raw-deflate.js
/**
	* Gets the Huffman codes from the code lengths.
	* @param {Uint8Array} lengths The code lengths.
	* @returns {Uint16Array} The Huffman codes.
	*/
	var getCodesFromLengths = (lengths) => {
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
	};
	/**
	* Gets the lengths of a Huffman code.
	* @param {Uint32Array} freqs The frequency counts.
	* @param {number} limit The code length limit.
	* @returns {Uint8Array} The code lengths.
	*/
	var getLengths = (freqs, limit) => {
		const heap = new Heap(572);
		const length = new Uint8Array(freqs.length);
		for (let i = 0; i < freqs.length; i++) if (freqs[i] > 0) heap.push(i, freqs[i]);
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
	};
	/**
	* Calculates the tree symbols.
	* @param {number} hLit The HLIT.
	* @param {Uint8Array} litLenLengths The literal lengths and length codes.
	* @param {number} hDist The HDIST.
	* @param {Uint8Array} distLengths The distance code lengths.
	* @returns {object} The tree symbols.
	*/
	var getTreeSymbols = (hLit, litLenLengths, hDist, distLengths) => {
		const src = new Uint32Array(hLit + hDist);
		const result = /* @__PURE__ */ new Uint32Array(316);
		const freqs = /* @__PURE__ */ new Uint8Array(19);
		let j = 0;
		for (let i = 0; i < hLit; i++) src[j++] = litLenLengths[i];
		for (let i = 0; i < hDist; i++) src[j++] = distLengths[i];
		let nResult = 0;
		for (let i = 0; i < src.length; i += j) {
			for (j = 1; i + j < src.length && src[i + j] === src[i]; j++);
			let runLength = j;
			if (src[i] === 0) {
				if (runLength < 3) while (runLength-- > 0) {
					result[nResult++] = 0;
					freqs[0]++;
				}
				else while (runLength > 0) {
					let rpt = Math.min(runLength, 138);
					if (rpt > runLength - 3 && rpt < runLength) rpt = runLength - 3;
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
			} else {
				result[nResult++] = src[i];
				freqs[src[i]]++;
				runLength--;
				if (runLength < 3) while (runLength-- > 0) {
					result[nResult++] = src[i];
					freqs[src[i]]++;
				}
				else while (runLength > 0) {
					let rpt = Math.min(runLength, 6);
					if (rpt > runLength - 3 && rpt < runLength) rpt = runLength - 3;
					result[nResult++] = 16;
					result[nResult++] = rpt - 3;
					freqs[16]++;
					runLength -= rpt;
				}
			}
		}
		return {
			codes: result.subarray(0, nResult),
			freqs
		};
	};
	/**
	* Finds the optimal Huffman code.
	* @param {Uint32Array} freqs The value frequencies.
	* @param {number} symbols The number of symbols.
	* @param {number} limit The code length limit.
	* @returns {Uint8Array} The code lengths.
	*/
	var reversePackageMerge = (freqs, symbols, limit) => {
		const minimumCost = new Uint16Array(limit);
		const flag = new Uint8Array(limit);
		const codeLengths = new Uint8Array(symbols);
		const value = new Array(limit);
		const type = new Array(limit);
		const currentPosition = new Array(limit);
		let excess = (1 << limit) - symbols;
		const half = 1 << limit - 1;
		minimumCost[limit - 1] = symbols;
		for (let i = 0; i < limit; i++) {
			if (excess < half) flag[i] = 0;
			else {
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
			if (minimumCost[i] > 2 * minimumCost[i - 1] + flag[i]) minimumCost[i] = 2 * minimumCost[i - 1] + flag[i];
			value[i] = new Array(minimumCost[i]);
			type[i] = new Array(minimumCost[i]);
		}
		for (let i = 0; i < symbols; i++) codeLengths[i] = limit;
		for (let i = 0; i < minimumCost[limit - 1]; i++) {
			value[limit - 1][i] = freqs[i];
			type[limit - 1][i] = i;
		}
		for (let i = 0; i < limit; i++) currentPosition[i] = 0;
		if (flag[limit - 1] === 1) {
			codeLengths[0]--;
			currentPosition[limit - 1]++;
		}
		const takePackage = (i) => {
			const x = type[i][currentPosition[i]];
			if (x === symbols) {
				takePackage(i + 1);
				takePackage(i + 1);
			} else codeLengths[x]--;
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
			if (flag[i] === 1) takePackage(i);
		}
		return codeLengths;
	};
	/**
	* RawDeflate Class
	* Based on https://github.com/imaya/zlib.js/blob/develop/src/rawdeflate.js
	* @class
	*/
	var RawDeflate = class {
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
			return new this(data, options).compress();
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
				...options
			};
			this.#input = input;
			this.#lazy = options.lazy;
			this.#lz77MinLength = options.lz77MinLength;
			this.#lz77MaxLength = options.lz77MaxLength;
			this.#outputIndex = 0;
			this.#output = /* @__PURE__ */ new Uint8Array(32768);
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
			let hLit;
			let hDist;
			for (hLit = 286; hLit > 257 && litLenLengths[hLit - 1] === 0; hLit--);
			for (hDist = 30; hDist > 1 && distLengths[hDist - 1] === 0; hDist--);
			const treeSymbols = getTreeSymbols(hLit, litLenLengths, hDist, distLengths);
			const treeLengths = getLengths(treeSymbols.freqs, 7);
			const transLengths = new Array(19);
			const hcLengthOrder = [
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
			];
			for (let i = 0; i < 19; i++) transLengths[i] = treeLengths[hcLengthOrder[i]];
			let hcLen = 19;
			for (; hcLen > 4 && transLengths[hcLen - 1] === 0; hcLen--);
			const treeCodes = getCodesFromLengths(treeLengths);
			stream.writeBits(hLit - 257, 5, true);
			stream.writeBits(hDist - 1, 5, true);
			stream.writeBits(hcLen - 4, 4, true);
			for (let i = 0; i < hcLen; i++) stream.writeBits(transLengths[i], 3, true);
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
			for (let i = 0; i < data.length; i++) {
				const literal = data[i];
				stream.writeBits(litLenCodes[literal], litLenLengths[literal], true);
				if (literal > 256) {
					stream.writeBits(data[++i], data[++i], true);
					const code = data[++i];
					stream.writeBits(distCodes[code], distLengths[code], true);
					stream.writeBits(data[++i], data[++i], true);
				} else if (literal === 256) break;
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
			const freqsLitLen = /* @__PURE__ */ new Uint32Array(286);
			const freqsDist = /* @__PURE__ */ new Uint32Array(30);
			freqsLitLen[256] = 1;
			const table = {};
			let pos = 0;
			let skipLength = 0;
			let prevMatch;
			const writeMatch = (match, offset) => {
				const tempArray = match.toLz77Array();
				for (let i = 0; i < tempArray.length; i++) lz77buf[pos++] = tempArray[i];
				freqsLitLen[tempArray[0]]++;
				freqsDist[tempArray[3]]++;
				skipLength = match.length + offset - 1;
				prevMatch = null;
			};
			for (let position = 0; position < this.#input.length; position++) {
				let matchKey = 0;
				for (let i = 0; i < this.#lz77MinLength; i++) {
					if (position + i === this.#input.length) break;
					matchKey = matchKey << 8 | this.#input[position + i];
				}
				if (!(matchKey in table)) table[matchKey] = [];
				const matchList = table[matchKey];
				if (skipLength-- > 0) {
					matchList.push(position);
					continue;
				}
				while (matchList.length > 0 && position - matchList[0] > 32768) matchList.shift();
				if (position + this.#lz77MinLength >= this.#input.length) {
					if (prevMatch) writeMatch(prevMatch, -1);
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
						} else writeMatch(prevMatch, -1);
					} else if (longestMatch.length < this.#lazy) prevMatch = longestMatch;
					else writeMatch(longestMatch, 0);
				} else if (prevMatch) writeMatch(prevMatch, -1);
				else {
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
			permatch: for (let i = 0; i < length; i++) {
				const match = matchList[length - i - 1];
				let matchLength = this.#lz77MinLength;
				if (matchMax > this.#lz77MinLength) {
					for (let j = matchMax; j > this.#lz77MinLength; j--) if (this.#input[match + j - 1] !== this.#input[position + j - 1]) continue permatch;
					matchLength = matchMax;
				}
				while (matchLength < this.#lz77MaxLength && position + matchLength < this.#input.length && this.#input[match + matchLength] === this.#input[position + matchLength]) matchLength++;
				if (matchLength > matchMax) {
					currentMatch = match;
					matchMax = matchLength;
				}
				if (matchLength === this.#lz77MaxLength) break;
			}
			return new Lz77Match(matchMax, position - currentMatch);
		}
	};

//#endregion
//#region src/js/zip/zip.js
	var encoder = new TextEncoder();
	/**
	* Encode a string in binary.
	* @param {string} string The string.
	* @returns {Uint8Array} The encoded string.
	*/
	var encode = (string) => {
		return encoder.encode(string);
	};
	/**
	* Gets the byte length of a string.
	* @param {string} string The string.
	* @returns {number} The byte length.
	*/
	var length = (string) => {
		return encode(string).length;
	};
	/**
	* Encodes an unsigned 16-bit integer in little-endian byte order.
	* @param {number} number The number.
	* @returns {Uint8Array} The encoded bytes.
	*/
	var signed16 = (number) => {
		const bytes = /* @__PURE__ */ new Uint8Array(2);
		new DataView(bytes.buffer).setUint16(0, number, true);
		return bytes;
	};
	/**
	* Encodes an unsigned 32-bit integer in little-endian byte order.
	* @param {number} number The number.
	* @returns {Uint8Array} The encoded bytes.
	*/
	var signed32 = (number) => {
		const bytes = /* @__PURE__ */ new Uint8Array(4);
		new DataView(bytes.buffer).setUint32(0, number, true);
		return bytes;
	};
	/**
	* Zip Class
	* Based on https://github.com/shuchkin/simplexlsxgen/blob/master/src/SimpleXLSXGen.php
	* @class
	*/
	var Zip = class {
		#dir;
		#entries;
		#files;
		#offset;
		#type;
		/**
		* Creates a Zip.
		* @param {string} [type=octet/stream] The file type.
		*/
		constructor(type = "octet/stream") {
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
			const now = /* @__PURE__ */ new Date();
			const year = Math.min(2107, Math.max(1980, now.getFullYear()));
			const modTime = now.getHours() << 11 | now.getMinutes() << 5 | Math.floor(now.getSeconds() / 2);
			const modDate = year - 1980 << 9 | now.getMonth() + 1 << 5 | now.getDate();
			const dir = [
				encode("PK"),
				signed16(0),
				signed16(vNeeded),
				signed16(2048),
				signed16(cMethod),
				signed16(modTime),
				signed16(modDate),
				signed32(crc32),
				signed32(compressedSize),
				signed32(uncompressedSize),
				signed16(filenameLength),
				signed16(0),
				signed16(0),
				signed16(0),
				signed16(0),
				signed32(32),
				signed32(this.#offset),
				encode(filename)
			];
			this.#dir.push(...dir);
			const file = [
				encode("PK"),
				signed16(vNeeded),
				signed16(2048),
				signed16(cMethod),
				signed16(modTime),
				signed16(modDate),
				signed32(crc32),
				signed32(compressedSize),
				signed32(uncompressedSize),
				signed16(filenameLength),
				signed16(0),
				encode(filename),
				data
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
			return new Blob([
				...this.#files,
				...this.#dir,
				encode("PK"),
				signed16(0),
				signed16(0),
				signed16(this.#entries),
				signed16(this.#entries),
				signed32(dirLength),
				signed32(this.#offset),
				signed16(0)
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
/**
	* Workbook Class
	* Based on https://github.com/shuchkin/simplexlsxgen/blob/master/src/SimpleXLSXGen.php
	* @class
	*/
	var Workbook = class {
		#current;
		#sheets;
		#sKeys;
		#stringCount = 0;
		#sValues;
		/**
		* Creates a Workbook.
		*/
		constructor() {
			this.#current = 0;
			this.#sheets = [];
			this.#sKeys = /* @__PURE__ */ new Map();
			this.#sValues = [];
		}
		/**
		* Adds a sheet to the Workbook.
		* @param {object} data The sheet data.
		* @param {string} [name] The name of the sheet.
		*/
		addSheet(data, name = null) {
			this.#current++;
			if (!name) name = `Sheet${this.#current}`;
			name = String(name).replace(/[\\/?*[\]:]/g, "").replace(/^'+|'+$/g, "").slice(0, 31) || `Sheet${this.#current}`;
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
			this.#sKeys = /* @__PURE__ */ new Map();
			this.#sValues = [];
			this.#stringCount = 0;
			const worksheets = this.#sheets.map((sheet) => this.#sheetToXml(sheet, templates["xl/worksheets/sheet1.xml"]));
			const zip = new Zip("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
			for (let [filename, template] of Object.entries(templates)) switch (filename) {
				case "[Content_Types].xml": {
					const override = this.#sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
					template = template.replace("{sheets}", override);
					zip.addFile(filename, template);
					break;
				}
				case "xl/_rels/workbook.xml.rels": {
					let relationships = this.#sheets.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>\n`).join("");
					relationships += `<Relationship Id="rId${this.#sheets.length + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
					template = template.replace("{sheets}", relationships);
					zip.addFile(filename, template);
					break;
				}
				case "xl/workbook.xml": {
					const sheets = this.#sheets.map((sheet, index) => `<sheet name="${escape(sheet.name)}" sheetId="${index + 1}" state="visible" r:id="rId${index + 2}"/>`).join("");
					template = template.replace("{sheets}", sheets);
					zip.addFile(filename, template);
					break;
				}
				case "docProps/core.xml": {
					const date = (/* @__PURE__ */ new Date()).toISOString().substring(0, 19) + "Z";
					template = template.replaceAll("{date}", date);
					zip.addFile(filename, template);
					break;
				}
				case "xl/sharedStrings.xml": {
					const strings = this.#sValues.map((string) => `<si><t xml:space="preserve">${string}</t></si>`).join("\r\n");
					template = template.replace("{cnt}", String(this.#stringCount)).replace("{unique}", String(this.#sValues.length));
					template = template.replace("{strings}", strings);
					zip.addFile(filename, template);
					break;
				}
				case "xl/worksheets/sheet1.xml":
					for (const [index, xml] of worksheets.entries()) {
						filename = `xl/worksheets/sheet${index + 1}.xml`;
						zip.addFile(filename, xml);
					}
					break;
				default: zip.addFile(filename, template);
			}
			return zip.zip();
		}
		/**
		* Serializes a value without interpreting strings as spreadsheet formulas.
		* @param {*} value The cell value.
		* @param {string} reference The cell reference.
		* @param {number|null} forceStyle The optional header/footer style.
		* @returns {string} The cell XML.
		*/
		#cellToXml(value, reference, forceStyle) {
			if (value === null || value === void 0 || value === "") return "";
			let type = null;
			let style = forceStyle;
			let content;
			const text = String(value);
			if (typeof value === "boolean") {
				type = "b";
				content = value ? 1 : 0;
			} else if (typeof value === "number" && Number.isFinite(value) || /^[-+]?(?:0|[1-9]\d{0,14})(?:\.\d+)?$/.test(text)) content = Number(value);
			else if (/^[-+]?\d+(?:\.\d+)?%$/.test(text)) {
				content = parseFloat(text) / 100;
				style ??= text.includes(".") ? 3 : 2;
			} else {
				const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
				const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
				const time = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);
				try {
					if (iso || dmy) {
						const match = iso || dmy;
						content = formatDate(iso ? match[1] : match[3], match[2], iso ? match[3] : match[1], match[4] || 0, match[5] || 0, match[6] || 0);
						style ??= match[4] ? 6 : 4;
					} else if (time) {
						content = formatDate(0, 0, 0, ...time.slice(1));
						style ??= 5;
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
						if (!this.#sKeys.has(escaped)) {
							this.#sKeys.set(escaped, this.#sValues.length);
							this.#sValues.push(escaped);
						}
						content = this.#sKeys.get(escaped);
					}
				}
			}
			return `<c r="${reference}"${type ? ` t="${type}"` : ""}${style !== null ? ` s="${style}"` : ""}>` + (type === "inlineStr" ? `<is><t xml:space="preserve">${content}</t></is>` : `<v>${content}</v>`) + "</c>";
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
			const data = [
				...sheet.data.header ? [{
					values: sheet.data.header,
					style: 8
				}] : [],
				...(sheet.data.rows || []).map((values) => ({
					values,
					style: null
				})),
				...sheet.data.footer ? [{
					values: sheet.data.footer,
					style: 8
				}] : []
			];
			if (data.length > 1048576) throw new RangeError("Too many worksheet rows.");
			for (const [index, { values, style }] of data.entries()) {
				if (!Array.isArray(values) || values.length > 16384) throw new RangeError("Invalid worksheet row.");
				const cells = values.map((value, column) => {
					widths[column] = Math.max(widths[column] || 0, String(value ?? "").length);
					return this.#cellToXml(value, `${colName(column + 1)}${index + 1}`, style);
				}).join("");
				rows.push(`<row r="${index + 1}">${cells}</row>`);
			}
			const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(width + 5, 60)}"/>`);
			const ref = rows.length && widths.length ? `A1:${colName(widths.length)}${rows.length}` : "A1";
			return template.replace("{ref}", ref).replace("{cols}", cols.join("")).replace("{rows}", rows.join(""));
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
		const lines = [headings, ...rows].map((row) => row.map((value) => {
			let text = String(value ?? "");
			if (options.escapeFormulae !== false && typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
			return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
		}).join(","));
		saveBlob(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }), `${title}.csv`);
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
		win.document.documentElement.dir = table.dir || document.documentElement.dir;
		const heading = win.document.createElement("h1");
		heading.textContent = title;
		_fr0st_query.default.addClass(table, classes || "");
		win.document.body.append(heading, table);
		const loads = [];
		for (const element of document.querySelectorAll("link[rel=\"stylesheet\"], style")) {
			const clone = win.document.importNode(element, true);
			if (clone.tagName === "LINK") {
				clone.href = element.href;
				loads.push(new Promise((resolve) => {
					clone.addEventListener("load", resolve, { once: true });
					clone.addEventListener("error", resolve, { once: true });
				}));
			}
			win.document.head.append(clone);
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
	var Table = class extends _fr0st_ui.BaseComponent {
		static buttons = {
			csv(options) {
				csv(options, this.#getExportData(options));
			},
			excel(options) {
				excel(options, this.#getExportData(options));
			},
			print(options) {
				const columns = options.columns || this.#getVisibleColumns();
				print(options, this.#buildTable(columns), _fr0st_query.default.getAttribute(this.node, "class"));
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
			sanitize: (html) => _fr0st_query.default.sanitize(html),
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
		#columnCount;
		#columns;
		#container;
		#data;
		#drawVersion = 0;
		#filtered;
		#getData;
		#headings;
		#id;
		#infoContainer;
		#lengthSelect;
		#limit;
		#loader;
		#loadResults;
		#offset;
		#order;
		#original;
		#originalBusy;
		#originalClass;
		#originalDescription;
		#page;
		#pagination;
		#pending;
		#requestVersion = 0;
		#results;
		#rowIndexes;
		#searchHandler;
		#searchInput;
		#tbody;
		#term;
		#tfoot;
		#theadRow;
		#total;
		#totalPages;
		/**
		* Creates a Table.
		* @param {HTMLTableElement} node The input table.
		* @param {TableOptions} [options] The component options.
		*/
		constructor(node, options) {
			if (node?.tagName !== "TABLE") throw new TypeError("Table requires a table element.");
			const configured = {
				...new.target.defaults,
				...(0, _fr0st_ui.getDataset)(node),
				...options
			};
			for (const key of [
				"order",
				"lengths",
				"buttons"
			]) if (!Array.isArray(configured[key])) throw new TypeError(`${key} must be an array.`);
			if (configured.columns !== null && !Array.isArray(configured.columns)) throw new TypeError("Columns must be an array.");
			if (typeof configured.sanitize !== "function") throw new TypeError("sanitize must be a function.");
			if (configured.lengths.some((length) => !Number.isSafeInteger(Number(length)) || Number(length) <= 0)) throw new RangeError("Page lengths must be positive integers.");
			const headings = getDomHeadings(node);
			if (configured.columns && headings.length && configured.columns.length !== headings.length) throw new RangeError("Column definitions must match the heading count.");
			if (configured.paging && (!Number.isSafeInteger(Number(configured.length)) || Number(configured.length) <= 0)) throw new RangeError("Page length must be a positive integer.");
			super(node, options);
			for (const key of [
				"order",
				"lengths",
				"buttons"
			]) this.options[key].splice(0, this.options[key].length, ...configured[key]);
			this.#originalClass = _fr0st_query.default.getAttribute(node, "class");
			this.#originalDescription = _fr0st_query.default.getAttribute(node, "aria-describedby");
			this.#originalBusy = _fr0st_query.default.getAttribute(node, "aria-busy");
			this.#data = [];
			this.#results = [];
			this.#rowIndexes = [];
			this.#total = 0;
			this.#filtered = 0;
			this.#offset = 0;
			this.#term = "";
			this.#limit = this.options.paging ? Number(this.options.length) : Infinity;
			try {
				if (!this.options.getResults) {
					this.#data = this.options.data ?? getDomData(node);
					this.#validateRows(this.#data);
					this.#data = this.#data.slice();
				}
				this.#headings = headings;
				const columns = this.options.columns ?? headings.map((_, data) => ({ data }));
				this.#columns = columns.map((column, index) => ({
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
				if (!headings.length) this.#headings = this.#columns.map((column) => ({
					text: column.name ?? String(column.data),
					class: null
				}));
				for (const column of this.#columns) if (column.orderData !== null) {
					if (!Array.isArray(column.orderData)) throw new TypeError("orderData must be an array of column indexes.");
					column.orderData.forEach((index) => this.#validateColumn(index));
				}
				this.#order = this.#normalizeOrder(this.options.order);
				this.#getOrder();
				this.#columnCount = this.#getVisibleColumns().length;
				if (!node.id) {
					node.id = (0, _fr0st_ui.generateId)("table");
					this.#id = true;
				}
				if (this.options.getResults) this.#getResultsInit();
				else this.#getDataInit();
				this.#render();
				if (!this.node) return;
				this.#events();
				_fr0st_query.default.triggerEvent(this.node, "init.ui.table");
				if (this.node) this.#getData();
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
			this.#validateRows([row]);
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
			if (this.#searchInput) _fr0st_query.default.setValue(this.#searchInput, "");
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
			if (this.#id) _fr0st_query.default.removeAttribute(node, "id");
			for (const [attribute, value] of [
				["class", this.#originalClass],
				["aria-describedby", this.#originalDescription],
				["aria-busy", this.#originalBusy]
			]) if (value === null || value === void 0) _fr0st_query.default.removeAttribute(node, attribute);
			else _fr0st_query.default.setAttribute(node, { [attribute]: value });
			if (this.#container) {
				this.#container.before(node);
				_fr0st_query.default.remove(this.#container);
			}
			if (this.#original) node.replaceChildren(...this.#original.childNodes);
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
			this.#getData = null;
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
			return modified ? this.#rowIndexes.map((rowIndex) => _fr0st_query.default._getDot(this.#data[rowIndex], `${key}`)) : this.#data.map((row) => _fr0st_query.default._getDot(row, `${key}`));
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
			return _fr0st_query.default._isPlainObject(this.#data[rowIndex]) ? { ...this.#data[rowIndex] } : [...this.#data[rowIndex]];
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
			return _fr0st_query.default._getDot(this.#data[rowIndex], `${key}`);
		}
		/**
		* Toggles a column as hidden.
		* @param {number} index The column index.
		*/
		hideColumn(index) {
			this.#validateColumn(index);
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
			length = Number(length);
			if (!Number.isSafeInteger(length) || length <= 0) throw new RangeError("Page length must be a positive integer.");
			this.#limit = length;
			this.#offset -= this.#offset % length;
			this.#syncLength();
			_fr0st_query.default.triggerEvent(this.node, "length.ui.table");
			if (this.node) this.#getData();
		}
		/**
		* Triggers the loading indicator.
		* @param {object} [options] Options for the loading indicator.
		* @param {boolean} [options.show=true] Whether to show the loading indicator.
		*/
		loading({ show = true } = {}) {
			if (!this.node) return;
			_fr0st_query.default.setAttribute(this.node, { "aria-busy": String(show) });
			if (show) {
				_fr0st_query.default.show(this.#loader);
				_fr0st_query.default.triggerEvent(this.node, "processing.ui.table");
			} else {
				_fr0st_query.default.hide(this.#loader);
				_fr0st_query.default.triggerEvent(this.node, "processed.ui.table");
			}
		}
		/**
		* Sets the Table order data.
		* @param {Array} order The order data.
		*/
		order(order) {
			if (!this.node || !this.options.ordering) return;
			this.#order = this.#normalizeOrder(order);
			_fr0st_query.default.triggerEvent(this.node, "order.ui.table");
			if (this.node) this.#getData();
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
			_fr0st_query.default.triggerEvent(this.node, "page.ui.table");
			if (this.node) this.#getData();
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
			this.#getData();
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
			if (this.#searchInput) _fr0st_query.default.setValue(this.#searchInput, this.#term);
			_fr0st_query.default.triggerEvent(this.node, "search.ui.table");
			if (this.node) this.#getData();
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
			for (const [index, rowIndex] of indexes.entries()) _fr0st_query.default._setDot(this.#data[rowIndex], String(key), column[index]);
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
			this.#validateRows([row]);
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
			_fr0st_query.default._setDot(this.#data[rowIndex], String(key), value);
			this.#mutated();
		}
		/**
		* Toggles a column as visible.
		* @param {number} index The column index.
		*/
		showColumn(index) {
			this.#validateColumn(index);
			this.#columns[index].visible = true;
			this.#renderResults();
		}
		/**
		* Renders a table for specific columns.
		* @param {Array} columns The columns to render.
		* @returns {HTMLElement} The table element.
		*/
		#buildTable(columns) {
			const table = _fr0st_query.default.create("table");
			table.dir = getComputedStyle(this.node).direction;
			const thead = _fr0st_query.default.create("thead");
			const tr = _fr0st_query.default.create("tr");
			for (const heading of this.#getHeadings(columns)) {
				const th = _fr0st_query.default.create("th", { text: heading });
				_fr0st_query.default.append(tr, th);
			}
			_fr0st_query.default.append(thead, tr);
			_fr0st_query.default.append(table, thead);
			const tbody = _fr0st_query.default.create("tbody");
			for (const row of this.#getResultRows(columns)) {
				const tr = _fr0st_query.default.create("tr");
				for (const value of row) {
					const td = _fr0st_query.default.create("td", { text: value });
					_fr0st_query.default.append(tr, td);
				}
				_fr0st_query.default.append(tbody, tr);
			}
			_fr0st_query.default.append(table, tbody);
			return table;
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
			if (this.#lengthSelect) _fr0st_query.default.addEvent(this.#lengthSelect, "change.ui.table", () => {
				const length = _fr0st_query.default.getValue(this.#lengthSelect);
				this.length(length);
			});
			if (this.#searchInput) {
				this.#searchHandler = _fr0st_query.default._debounce(() => {
					if (this.node) this.search(_fr0st_query.default.getValue(this.#searchInput));
				}, this.options.getResults ? 0 : this.options.debounce);
				_fr0st_query.default.addEvent(this.#searchInput, "input.ui.table", this.#searchHandler);
			}
			if (this.options.ordering) {
				const handleSort = (event) => {
					const index = Number(_fr0st_query.default.getDataset(event.currentTarget, "uiIndex"));
					if (!this.#columns[index].orderable) return;
					event.preventDefault();
					const defaultDir = this.#columns[index].dir;
					let currentDir = null;
					for (const [col, dir] of this.#order) {
						if (col !== index) continue;
						currentDir = dir;
						break;
					}
					let nextDir = defaultDir;
					if (currentDir === defaultDir) nextDir = defaultDir === "asc" ? "desc" : "asc";
					let order;
					if (event.shiftKey) {
						if (!currentDir) order = [...this.#order, [index, nextDir]];
						else if (currentDir === defaultDir) order = this.#order.map(([col, dir]) => {
							if (col === index) dir = nextDir;
							return [col, dir];
						});
						else order = this.#order.filter(([col]) => {
							return col !== index;
						});
					} else order = [[index, nextDir]];
					this.order(order);
				};
				_fr0st_query.default.addEventDelegate(this.#theadRow, "click.ui.table", "th", handleSort);
				_fr0st_query.default.addEventDelegate(this.#theadRow, "keydown.ui.table", "th", (event) => {
					switch (event.code) {
						case "Enter":
						case "NumpadEnter":
						case "Space": handleSort(event);
					}
				});
			}
			if (this.#pagination) _fr0st_query.default.addEventDelegate(this.#pagination, "click.ui.table", "[data-ui-page]", (event) => {
				event.preventDefault();
				if (event.currentTarget.disabled) return;
				let page = _fr0st_query.default.getDataset(event.currentTarget, "uiPage");
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
			const request = { columns: { ...this.#columns.map((column) => ({
				...column.name ? { name: column.name } : {},
				data: column.data,
				orderable: column.orderable,
				searchable: column.searchable
			})) } };
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
				this.#validateRows(response?.results);
				if (!Number.isSafeInteger(response.total) || !Number.isSafeInteger(response.filtered) || response.total < 0 || response.filtered < 0 || response.filtered > response.total || response.results.length > response.filtered || this.options.paging && response.results.length > this.#limit) throw new TypeError("Remote counts and rows must describe a valid result page.");
			} catch (error) {
				if (active()) {
					this.#pending = null;
					this.loading({ show: false });
					if (active()) _fr0st_query.default.triggerEvent(this.node, "error.ui.table", { detail: { error } });
				}
				return;
			}
			this.#pending = null;
			this.#total = response.total;
			this.#filtered = response.filtered;
			if (this.options.paging && this.#offset >= this.#filtered && this.#offset > 0) {
				this.#offset = Math.max(0, (Math.ceil(this.#filtered / this.#limit) - 1) * this.#limit);
				this.#getData();
				return;
			}
			this.#data = response.results.slice();
			this.#refreshResults();
			this.loading({ show: false });
			if (active()) this.#renderResults();
		}
		/**
		* Initializes preloaded get data.
		*/
		#getDataInit() {
			this.#getData = () => {
				const version = ++this.#drawVersion;
				this.loading();
				if (!this.node || version !== this.#drawVersion) return;
				this.#updateLocal();
				this.loading({ show: false });
				if (this.node && version === this.#drawVersion) this.#renderResults();
			};
		}
		/**
		* Copies the headings and displayed rows required by an export button.
		* @param {TableButton} options The export button options.
		* @returns {{headings: string[], rows: Array<Array<*>>}} The export data.
		*/
		#getExportData(options) {
			const columns = options.columns || this.#getVisibleColumns();
			return {
				headings: this.#getHeadings(columns),
				rows: this.#getResultRows(columns)
			};
		}
		/**
		* Gets headings for specific columns.
		* @param {Array} columns The columns to get.
		* @returns {Array} The headings.
		*/
		#getHeadings(columns) {
			return columns.map((index) => {
				this.#validateColumn(index);
				const container = document.createElement("div");
				_fr0st_query.default.setHtml(container, _fr0st_query.default.sanitize(String(this.#headings[index].text)));
				return _fr0st_query.default.getText(container);
			});
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
		* Gets real column ordering data.
		* @returns {Array} The column ordering data.
		*/
		#getOrder() {
			return this.#order.flatMap(([index, direction]) => {
				return (this.#columns[index].orderData ?? [index]).map((column) => {
					this.#validateColumn(column);
					return [column, direction];
				});
			});
		}
		/**
		* Gets results for specific columns.
		* @param {Array} columns The columns to get.
		* @returns {Array} The results.
		*/
		#getResultRows(columns) {
			for (const index of columns) this.#validateColumn(index);
			return this.#results.map((row) => columns.map((index) => _fr0st_query.default._getDot(row, String(this.#columns[index].data))));
		}
		/**
		* Initializes get data from callback.
		*/
		#getResultsInit() {
			this.#loadResults = _fr0st_query.default._debounce((version) => this.#fetchResults(version), this.options.debounce);
			this.#getData = () => {
				this.#drawVersion++;
				const version = this.#cancelRequest();
				if (!this.node || version !== this.#requestVersion) return;
				this.loading();
				if (this.node && version === this.#requestVersion) this.#loadResults(version);
			};
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
		* Redraws after a row mutation; remote mutations affect the loaded page only.
		* @param {number} [change=0] The change in the remote row count.
		*/
		#mutated(change = 0) {
			if (!this.node) return;
			if (this.options.getResults) {
				const version = this.#cancelRequest();
				if (!this.node || version !== this.#requestVersion) return;
				this.#total = Math.max(0, this.#total + change);
				this.#filtered = Math.max(0, this.#filtered + change);
				if (!this.#data.length && this.#offset) {
					this.#offset = Math.max(0, this.#offset - this.#limit);
					this.#getData();
					return;
				}
				this.#refreshResults();
				this.loading({ show: false });
				if (this.node) this.#renderResults();
			} else this.#getData();
		}
		/**
		* Validates and copies ordering, ignoring nonorderable columns.
		* @param {TableOrder[]} order The requested order.
		* @returns {TableOrder[]} The normalized order.
		*/
		#normalizeOrder(order) {
			if (!Array.isArray(order)) throw new TypeError("Order must be an array.");
			return order.flatMap((entry) => {
				if (!Array.isArray(entry) || entry.length !== 2 || !["asc", "desc"].includes(entry[1])) throw new TypeError("Order entries must contain a column index and asc/desc direction.");
				if (!this.#columns.length && entry[0] === 0) return [];
				this.#validateColumn(entry[0]);
				return this.#columns[entry[0]].orderable ? [[...entry]] : [];
			});
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
			this.#original = document.createDocumentFragment();
			this.#original.append(...this.node.childNodes);
			this.#container = _fr0st_query.default.create("div", { class: this.constructor.classes.container });
			this.#loader = _fr0st_query.default.create("div", {
				class: this.constructor.classes.loader,
				attributes: {
					"role": "progressbar",
					"aria-label": this.options.lang.loading
				}
			});
			const loaderIcon = _fr0st_query.default.create("span", { class: this.constructor.classes.loaderIcon });
			_fr0st_query.default.append(this.#loader, loaderIcon);
			_fr0st_query.default.addClass(this.node, this.constructor.classes.table);
			const caption = _fr0st_query.default.findOne("caption", this.#original);
			if (caption) _fr0st_query.default.append(this.node, _fr0st_query.default.clone(caption));
			const thead = _fr0st_query.default.create("thead");
			_fr0st_query.default.append(this.node, thead);
			this.#theadRow = _fr0st_query.default.create("tr");
			_fr0st_query.default.append(thead, this.#theadRow);
			this.#tbody = _fr0st_query.default.create("tbody");
			_fr0st_query.default.append(this.node, this.#tbody);
			const tfoot = _fr0st_query.default.findOne("tfoot", this.#original);
			if (tfoot) {
				this.#tfoot = tfoot.cloneNode(true);
				_fr0st_query.default.append(this.node, this.#tfoot);
			}
			_fr0st_query.default.hide(this.#loader);
			_fr0st_query.default.after(this.node, this.#container);
			_fr0st_query.default.append(this.#container, this.#loader);
			if (this.options.layout.top) {
				this.#renderLayoutRow(this.options.layout.top, this.constructor.classes.topRow);
				if (!this.node) return;
			}
			const tableContainer = _fr0st_query.default.create("div", { class: this.constructor.classes.tableContainer });
			_fr0st_query.default.append(tableContainer, this.node);
			_fr0st_query.default.append(this.#container, tableContainer);
			if (this.options.layout.bottom) {
				this.#renderLayoutRow(this.options.layout.bottom, this.constructor.classes.bottomRow);
				if (!this.node) return;
			}
			if (this.#infoContainer) _fr0st_query.default.setAttribute(this.node, { "aria-describedby": [this.#originalDescription, this.#infoContainer.id].filter(Boolean).join(" ") });
		}
		/**
		* Renders the table buttons.
		* @param {HTMLElement} container The container to render in.
		*/
		#renderButtons(container) {
			const btnGroup = _fr0st_query.default.create("div", { class: this.constructor.classes.buttonGroup });
			for (const button of this.options.buttons) {
				const btn = _fr0st_query.default.create("button", {
					class: this.constructor.classes.button,
					text: !button.text && button.type in this.options.lang.buttons ? this.options.lang.buttons[button.type] : button.text,
					attributes: {
						"type": "button",
						"aria-controls": _fr0st_query.default.getAttribute(this.node, "id")
					}
				});
				_fr0st_query.default.addEvent(btn, "click.ui.table", (event) => {
					event.preventDefault();
					if (button.callback) button.callback.bind(this)();
					else if (Object.hasOwn(this.constructor.buttons, button.type)) this.constructor.buttons[button.type].bind(this)(button);
				});
				_fr0st_query.default.append(btnGroup, btn);
			}
			_fr0st_query.default.append(container, btnGroup);
		}
		/**
		* Renders the table headings.
		*/
		#renderHeadings() {
			const version = this.#drawVersion;
			const children = _fr0st_query.default.children(this.#theadRow);
			const headings = {};
			for (const child of children) {
				const index = _fr0st_query.default.getDataset(child, "uiIndex");
				if (!this.#columns[index].visible) _fr0st_query.default.detach(child);
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
					cell = _fr0st_query.default.create("th", {
						class: this.constructor.classes.tableHeading,
						html,
						dataset: { uiIndex: index }
					});
					if (heading.class) _fr0st_query.default.addClass(cell, heading.class);
					if (this.options.ordering && this.#columns[index].orderable) {
						_fr0st_query.default.addClass(cell, this.constructor.classes.tableSort);
						_fr0st_query.default.setAttribute(cell, {
							"tabindex": 0,
							"aria-controls": _fr0st_query.default.getAttribute(this.node, "id")
						});
					}
					if (!this.node) return;
					if (!lastCell) _fr0st_query.default.prepend(this.#theadRow, cell);
					else _fr0st_query.default.insertAfter(cell, lastCell);
				}
				lastCell = cell;
				if (!this.options.ordering || !this.#columns[index].orderable) continue;
				let dir;
				for (const order of this.#order) {
					if (order[0] !== index) continue;
					dir = order[1];
					break;
				}
				switch (dir) {
					case "asc":
						_fr0st_query.default.addClass(cell, this.constructor.classes.tableSortAsc);
						_fr0st_query.default.removeClass(cell, this.constructor.classes.tableSortDesc);
						_fr0st_query.default.setAttribute(cell, { "aria-sort": "ascending" });
						break;
					case "desc":
						_fr0st_query.default.addClass(cell, this.constructor.classes.tableSortDesc);
						_fr0st_query.default.removeClass(cell, this.constructor.classes.tableSortAsc);
						_fr0st_query.default.setAttribute(cell, { "aria-sort": "descending" });
						break;
					default:
						_fr0st_query.default.removeClass(cell, [this.constructor.classes.tableSortAsc, this.constructor.classes.tableSortDesc]);
						_fr0st_query.default.removeAttribute(cell, "aria-sort");
				}
				const text = _fr0st_query.default.getText(cell);
				if (dir === "asc" || !dir && this.#columns[index].dir === "desc") _fr0st_query.default.setAttribute(cell, { "aria-label": `${text}${this.options.lang.aria.sortDescending}` });
				else _fr0st_query.default.setAttribute(cell, { "aria-label": `${text}${this.options.lang.aria.sortAscending}` });
			}
		}
		/**
		* Renders the table info.
		*/
		#renderInfo() {
			const version = this.#drawVersion;
			_fr0st_query.default.empty(this.#infoContainer);
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
			const text = _fr0st_query.default.create("small", { text: infoText });
			_fr0st_query.default.append(this.#infoContainer, text);
		}
		/**
		* Renders the table info container in a container.
		* @param {HTMLElement} container The container to render in.
		*/
		#renderInfoContainer(container) {
			if (!this.options.info) return;
			const id = (0, _fr0st_ui.generateId)("table-info");
			this.#infoContainer = _fr0st_query.default.create("div", {
				class: this.constructor.classes.infoContainer,
				attributes: {
					id,
					"role": "status",
					"aria-live": "polite"
				}
			});
			_fr0st_query.default.append(container, this.#infoContainer);
		}
		/**
		* Renders a layout row in a container.
		* @param {Array} columns The columns to render.
		* @param {string} rowClass The row class.
		*/
		#renderLayoutRow(columns, rowClass) {
			const row = _fr0st_query.default.create("div", { class: rowClass });
			for (const elements of columns.split(",")) {
				const column = _fr0st_query.default.create("div", { class: this.constructor.classes.column });
				for (const element of elements.split("|")) {
					if (!Object.hasOwn(this.constructor.layout, element)) continue;
					const container = _fr0st_query.default.create("div", { class: this.constructor.classes.columnContainer });
					this.constructor.layout[element].call(this, container);
					if (!this.node) return;
					_fr0st_query.default.append(column, container);
				}
				_fr0st_query.default.append(row, column);
			}
			_fr0st_query.default.append(this.#container, row);
		}
		/**
		* Renders the length select in a container.
		* @param {HTMLElement} container The container to render in.
		*/
		#renderLengthSelect(container) {
			if (!this.options.lengthChange || !this.options.paging) return;
			const lengthContainer = _fr0st_query.default.create("div", { class: this.constructor.classes.lengthContainer });
			const label = _fr0st_query.default.create("label", { class: this.constructor.classes.lengthLabel });
			_fr0st_query.default.append(lengthContainer, label);
			const labelText = _fr0st_query.default.create("small", {
				class: this.constructor.classes.lengthLabelText,
				text: this.options.lang.perPage
			});
			_fr0st_query.default.append(label, labelText);
			const inputContainer = _fr0st_query.default.create("div", {
				class: this.constructor.classes.lengthInputContainer,
				style: { width: "initial" }
			});
			_fr0st_query.default.append(label, inputContainer);
			this.#lengthSelect = _fr0st_query.default.create("select", {
				class: this.options.inputStyle === "filled" ? this.constructor.classes.lengthInputFilled : this.constructor.classes.lengthInputOutline,
				attributes: { "aria-controls": _fr0st_query.default.getAttribute(this.node, "id") }
			});
			_fr0st_query.default.append(inputContainer, this.#lengthSelect);
			for (const length of this.options.lengths) {
				const option = _fr0st_query.default.create("option", {
					value: length,
					text: length
				});
				_fr0st_query.default.append(this.#lengthSelect, option);
			}
			this.#syncLength();
			_fr0st_query.default.append(container, lengthContainer);
		}
		/**
		* Renders a pagination item.
		* @param {object} options Options for rendering the pagnination item.
		* @returns {HTMLElement} The pagnination item.
		*/
		#renderPageItem(options) {
			const container = _fr0st_query.default.create("div", { class: this.constructor.classes.pageItem });
			const link = _fr0st_query.default.create("button", {
				html: options.icon || options.text || options.page,
				class: this.constructor.classes.pageLink,
				attributes: {
					"type": "button",
					"title": options.text ? `${options.text} ${this.options.lang.page}` : `${this.options.lang.page} ${options.page}`,
					"aria-label": options.text ? `${options.text} ${this.options.lang.page}` : `${this.options.lang.page} ${options.page}`,
					"aria-controls": _fr0st_query.default.getAttribute(this.node, "id")
				},
				dataset: { uiPage: options.page }
			});
			_fr0st_query.default.append(container, link);
			return container;
		}
		/**
		* Renders the pagination.
		*/
		#renderPagination() {
			const setDisabled = (container, disabled) => {
				const link = _fr0st_query.default.findOne(":scope > [data-ui-page]", container);
				_fr0st_query.default.setProperty(link, { disabled });
				if (disabled) {
					_fr0st_query.default.addClass(container, this.constructor.classes.pageDisabled);
					_fr0st_query.default.setAttribute(link, {
						"aria-disabled": true,
						"tabindex": -1
					});
				} else {
					_fr0st_query.default.removeClass(container, this.constructor.classes.pageDisabled);
					_fr0st_query.default.removeAttribute(link, "aria-disabled");
					_fr0st_query.default.removeAttribute(link, "tabindex");
				}
			};
			const children = _fr0st_query.default.children(this.#pagination);
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
				_fr0st_query.default.append(this.#pagination, firstPage);
				prevPage = this.#renderPageItem({
					text: this.options.lang.paginate.previous,
					icon: this.options.icons.previous,
					page: "prev"
				});
				_fr0st_query.default.append(this.#pagination, prevPage);
				nextPage = this.#renderPageItem({
					text: this.options.lang.paginate.next,
					icon: this.options.icons.next,
					page: "next"
				});
				_fr0st_query.default.append(this.#pagination, nextPage);
				lastPage = this.#renderPageItem({
					text: this.options.lang.paginate.last,
					icon: this.options.icons.last,
					page: "last"
				});
				_fr0st_query.default.append(this.#pagination, lastPage);
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
				const link = _fr0st_query.default.findOne(":scope > [data-ui-page]", child);
				const page = _fr0st_query.default.getDataset(link, "uiPage");
				if (page < startPage || page > endPage) _fr0st_query.default.detach(child);
				else pageLinks[page] = child;
			}
			let lastLink = prevPage;
			for (let current = startPage; current <= endPage; current++) {
				let pageItem;
				if (current in pageLinks) pageItem = pageLinks[current];
				else {
					pageItem = this.#renderPageItem({ page: current });
					_fr0st_query.default.insertAfter(pageItem, lastLink);
				}
				const pageButton = _fr0st_query.default.findOne("button", pageItem);
				if (current === this.#page) {
					_fr0st_query.default.setAttribute(pageButton, { "aria-current": "page" });
					_fr0st_query.default.addClass(pageItem, this.constructor.classes.pageActive);
				} else {
					_fr0st_query.default.removeAttribute(pageButton, "aria-current");
					_fr0st_query.default.removeClass(pageItem, this.constructor.classes.pageActive);
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
			const paginationContainer = _fr0st_query.default.create("div", { class: this.constructor.classes.paginationContainer });
			_fr0st_query.default.append(container, paginationContainer);
			this.#pagination = _fr0st_query.default.create("div", { class: this.constructor.classes.pagination });
			_fr0st_query.default.append(paginationContainer, this.#pagination);
		}
		/**
		* Renders the table results.
		*/
		#renderResults() {
			if (!this.node) return;
			const version = ++this.#drawVersion;
			const active = () => this.node && version === this.#drawVersion;
			_fr0st_query.default.triggerEvent(this.node, "preDraw.ui.table");
			if (!active()) return;
			const proceed = this.options.preDrawCallback?.call(this);
			if (!active() || proceed === false) return;
			_fr0st_query.default.empty(this.#tbody);
			this.#columnCount = this.#getVisibleColumns().length;
			this.#renderHeadings();
			if (!active()) return;
			const end = this.#offset + this.#results.length;
			this.options.headerCallback?.call(this, this.#theadRow, this.#data, this.#offset, end, [...this.#rowIndexes]);
			if (!active()) return;
			if (this.#pagination) this.#renderPagination();
			if (this.#infoContainer) this.#renderInfo();
			if (!active()) return;
			if (!this.#results.length) {
				const row = _fr0st_query.default.create("tr");
				_fr0st_query.default.append(row, _fr0st_query.default.create("td", {
					class: this.constructor.classes.emptyCell,
					text: this.#term ? this.options.lang.noResults : this.options.lang.noData,
					attributes: { colspan: Math.max(1, this.#columnCount) }
				}));
				_fr0st_query.default.append(this.#tbody, row);
			} else for (const [index, result] of this.#results.entries()) {
				const row = this.#renderRow(result, index);
				if (!active()) return;
				this.options.rowCallback?.call(this, row, result, index, this.#offset + index, this.#rowIndexes[index]);
				if (!active()) return;
				_fr0st_query.default.append(this.#tbody, row);
				this.options.createdRow?.call(this, row, result, index);
				if (!active()) return;
			}
			this.options.drawCallback?.call(this);
			if (!active()) return;
			if (this.#tfoot) this.options.footerCallback?.call(this, this.#tfoot, this.#data, this.#offset, end, [...this.#rowIndexes]);
			if (active()) _fr0st_query.default.triggerEvent(this.node, "draw.ui.table");
		}
		/**
		* Renders a result row.
		* @param {Array|object} data The row data.
		* @param {number} rowIndex The row index.
		* @returns {HTMLElement} The table row.
		*/
		#renderRow(data, rowIndex) {
			const row = _fr0st_query.default.create("tr");
			const version = this.#drawVersion;
			for (const [index, column] of this.#columns.entries()) {
				if (!column.visible) continue;
				const value = _fr0st_query.default._getDot(data, String(column.data));
				const formatted = column.format ? column.format.call(this, value) : value;
				if (!this.node || version !== this.#drawVersion) return row;
				const html = this.options.sanitize(String(formatted ?? ""));
				if (!this.node || version !== this.#drawVersion) return row;
				const cell = _fr0st_query.default.create("td", {
					html,
					class: column.class || ""
				});
				column.createdCell?.call(this, cell, value, data, rowIndex, index);
				if (!this.node || version !== this.#drawVersion) return row;
				_fr0st_query.default.append(row, cell);
			}
			return row;
		}
		/**
		* Renders the search in a container.
		* @param {HTMLElement} container The container to render in.
		*/
		#renderSearch(container) {
			if (!this.options.searching) return;
			const searchContainer = _fr0st_query.default.create("div", { class: this.constructor.classes.searchContainer });
			const inputContainer = _fr0st_query.default.create("div", {
				class: this.constructor.classes.searchInputContainer,
				style: { width: "200px" }
			});
			_fr0st_query.default.append(searchContainer, inputContainer);
			this.#searchInput = _fr0st_query.default.create("input", {
				class: this.options.inputStyle === "filled" ? this.constructor.classes.searchInputFilled : this.constructor.classes.searchInputOutline,
				attributes: {
					"type": "search",
					"placeholder": this.options.lang.search,
					"aria-label": this.options.lang.search,
					"aria-controls": _fr0st_query.default.getAttribute(this.node, "id")
				}
			});
			_fr0st_query.default.append(inputContainer, this.#searchInput);
			_fr0st_query.default.append(container, searchContainer);
		}
		/**
		* Selects the current length, including a programmatically requested length.
		*/
		#syncLength() {
			if (!this.#lengthSelect) return;
			if (![...this.#lengthSelect.options].some((option) => Number(_fr0st_query.default.getValue(option)) === this.#limit)) _fr0st_query.default.append(this.#lengthSelect, _fr0st_query.default.create("option", {
				value: this.#limit,
				text: this.#limit
			}));
			_fr0st_query.default.setValue(this.#lengthSelect, this.#limit);
		}
		/**
		* Recomputes local matching, stable ordering, counts, and the current page.
		*/
		#updateLocal() {
			this.#total = this.#data.length;
			const term = this.#term.toLocaleLowerCase();
			let indexes = this.#data.map((_, index) => index).filter((index) => !term || this.#columns.some((column) => column.searchable && String(_fr0st_query.default._getDot(this.#data[index], String(column.data)) ?? "").toLocaleLowerCase().includes(term)));
			this.#filtered = indexes.length;
			const order = this.options.ordering ? this.#getOrder() : [];
			indexes.sort((a, b) => {
				for (const [index, direction] of order) {
					const key = String(this.#columns[index].data);
					const av = _fr0st_query.default._getDot(this.#data[a], key);
					const bv = _fr0st_query.default._getDot(this.#data[b], key);
					const diff = _fr0st_query.default._isNumeric(av) && _fr0st_query.default._isNumeric(bv) ? Number(av) - Number(bv) : String(av ?? "").toLocaleLowerCase().localeCompare(String(bv ?? "").toLocaleLowerCase());
					if (diff) return direction === "desc" ? -diff : diff;
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
		/**
		* Validates a data column index.
		* @param {number} index The column index.
		*/
		#validateColumn(index) {
			if (!Number.isInteger(index) || index < 0 || index >= this.#columns.length) throw new RangeError("Column index is out of range.");
		}
		/**
		* Validates a local or remote row collection.
		* @param {TableRow[]} rows The supplied rows.
		*/
		#validateRows(rows) {
			if (!Array.isArray(rows) || rows.some((row) => !Array.isArray(row) && !_fr0st_query.default._isPlainObject(row))) throw new TypeError("Results must be an array of arrays or plain objects.");
		}
	};

//#endregion
//#region src/js/index.js
	(0, _fr0st_ui.initComponent)("table", Table);
	var js_default = Table;

//#endregion
exports.Table = js_default;
});
//# sourceMappingURL=frost-ui-tables.js.map