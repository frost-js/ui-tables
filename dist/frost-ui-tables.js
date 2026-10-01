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
	* Build a data array from a DOM element.
	* @param {HTMLElement} element The element to parse.
	* @returns {Array} The parsed data.
	*/
	function getDataFromDOM(element) {
		const tbody = _fr0st_query.default.findOne("tbody", element);
		return _fr0st_query.default.children(tbody, "tr").map((row) => _fr0st_query.default.children(row, "td").map((cell) => _fr0st_query.default.getHtml(cell)));
	}
	/**
	* Build a heading array from a DOM element.
	* @param {HTMLElement} element The element to parse.
	* @returns {Array} The parsed data.
	*/
	function getHeadingsFromDOM(element) {
		const tbody = _fr0st_query.default.findOne("thead", element);
		const row = _fr0st_query.default.children(tbody, "tr").shift();
		return _fr0st_query.default.children(row, "th").map((cell) => ({
			text: _fr0st_query.default.getHtml(cell),
			class: _fr0st_query.default.getAttribute(cell, "class")
		}));
	}
	/**
	* Download a blob.
	* @param {Blob} blob The blob to save.
	* @param {string} filename The filename.
	*/
	function saveBlob(blob, filename) {
		const link = _fr0st_query.default.create("a", { attributes: {
			href: URL.createObjectURL(blob),
			download: filename
		} });
		_fr0st_query.default.append(document.body, link);
		_fr0st_query.default.click(link);
		_fr0st_query.default.detach(link);
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
		* Get the CRC32 hash value.
		* @param {Uint8Array} data The data to hash.
		* @param {number} [pos] The data position.
		* @param {number} [length] The data length.
		* @returns {number} The CRC32 hash.
		*/
		static calc(data, pos = 0, length = null) {
			return this.update(data, 0, pos, length);
		}
		/**
		* Update the CRC32 hash value.
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
		* New BitStream constructor.
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
		* Write bits to the buffer.
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
	* Get index of parent node.
	* @param {number} index The index.
	* @returns {number} The parent index.
	*/
	var getParent = (index) => {
		return ((index - 2) / 4 | 0) * 2;
	};
	/**
	* Get index of child node.
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
		* New Heap constructor.
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
		* Pop the top value off the heap.
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
		* Push a value onto the heap.
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
	* Get the distance code.
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
	* Get the length code.
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
		* New Lz77Match constructor.
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
		* Get the LZ77 coded array.
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
	* Get the Huffman codes from the code lengths.
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
	* Get the lengths of a Huffman code.
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
	* Calculate the tree symbols.
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
	* Find the optimal Huffman code.
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
		* Compress the data.
		* @param {Uint8Array} data The input data.
		* @param {object} options The options to create the RawDeflate with.
		* @returns {Uint8Array} The compressed data.
		*/
		static compress(data, options) {
			return new this(data, options).compress();
		}
		/**
		* New RawDeflate constructor.
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
		* Compress the data.
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
		* Calculate the LZ77 array.
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
		* Find the longest match from the list of matches.
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
				if (matchMax > this.#lz77MaxLength) {
					for (let j = matchMax; j > this.#lz77MinLength; j--) if (this.#input[match + j - 1] !== this.#input[position + j - 1]) continue permatch;
					matchLength = matchMax;
				}
				while (matchLength < this.#lz77MaxLength && position + matchLength < length && this.#input[match + matchLength] === this.#input[position + matchLength]) matchLength++;
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
	* Get the byte length of a string.
	* @param {string} string The string.
	* @returns {number} The byte length.
	*/
	var length = (string) => {
		return encode(string).length;
	};
	/**
	* Convert a number to an Int16Array.
	* @param {number} number The number.
	* @returns {Int16Array} The Int16Array.
	*/
	var signed16 = (number) => {
		return new Int16Array([number]);
	};
	/**
	* Convert a number to an Int32Array.
	* @param {number} number The number.
	* @returns {Int32Array} The Int32Array.
	*/
	var signed32 = (number) => {
		return new Int32Array([number]);
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
		* New Zip constructor.
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
			const now = /* @__PURE__ */ new Date();
			let offsetSeconds = now.getSeconds();
			if (offsetSeconds >= 32) offsetSeconds -= 32;
			const offsetYear = now.getYear() - 1980;
			const seconds = `${offsetSeconds.toString(2)}`.padStart(5, "0");
			const minutes = `${now.getMinutes().toString(2)}`.padStart(6, "0");
			const hours = `${now.getHours().toString(2)}`.padStart(5, "0");
			const date = `${now.getDate().toString(2)}`.padStart(5, "0");
			const month = `${now.getMonth().toString(2)}`.padStart(4, "0");
			const year = `${offsetYear.toString(2)}`.padStart(7, "0");
			const modTime = parseInt(`${hours}${minutes}${seconds}`, 2);
			const modDate = parseInt(`${year}${month}${date}`, 2);
			const dir = [
				encode("PK"),
				signed16(0),
				signed16(vNeeded),
				signed16(0),
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
				signed16(0),
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
		* Create the zip file.
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
	* Convert a column number to name.
	* @param {number} num The number.
	* @returns {string} The column name.
	*/
	function colName(num) {
		const code = 65 + (num - 1) % 26;
		const letter = String.fromCharCode(code);
		const nextNum = Math.round((num - 1) / 26);
		if (nextNum > 0) return colName(nextNum) + letter;
		return letter;
	}
	/**
	* Escape a string for Excel.
	* @param {string} string The input string.
	* @returns {string} The escaped string.
	*/
	function escape(string) {
		string = string.replace("&", "&amp;");
		string = string.replace("<", "&lt;");
		string = string.replace(">", "&gt;");
		string = string.replace("", "");
		return string;
	}
	/**
	* Convert a date to Excel format.
	* @param {number} year The year.
	* @param {number} month The month.
	* @param {number} day The day.
	* @param {number} [hours] The hours.
	* @param {number} [minutes] The minutes.
	* @param {number} [seconds] The seconds.
	* @returns {number} The Excel timestamp.
	*/
	function formatDate(year, month, day, hours = 0, minutes = 0, seconds = 0) {
		const time = (hours * 3600 + minutes * 60 + seconds) / 86400;
		if (!year) return time;
		let leapAdjust = 1;
		if (year == 1900 && month <= 2) leapAdjust = 0;
		if (month > 2) month -= 3;
		else {
			month += 9;
			year--;
		}
		const century = year.substring(0, 2);
		const decade = year.substring(2);
		return Math.floor(146097 * century / 4) + Math.floor(1461 * decade / 4) + Math.floor(153 * (month + 2) / 5) + day + 1721119 - 2415020 + leapAdjust;
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
		"xl/sharedStrings.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" count=\"{cnt}\" uniqueCount=\"{cnt}\">{strings}</sst>",
		"xl/styles.xml": "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"2\"><font><name val=\"Calibri\"/><family val=\"2\"/></font><font><name val=\"Calibri\"/><family val=\"2\"/><b/></font></fonts><fills count=\"1\"><fill><patternFill patternType=\"none\"/></fill></fills><borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" /></cellStyleXfs><cellXfs count=\"8\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"1\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"9\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"10\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"14\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"20\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"22\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\" applyAlignment=\"1\"><alignment horizontal=\"right\"/></xf><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"/></cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>",
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
		#sValues;
		/**
		* New Workbook constructor.
		*/
		constructor() {
			this.#current = 0;
			this.#sheets = [];
			this.#sKeys = {};
			this.#sValues = [];
		}
		/**
		* Add a sheet to the Workbook.
		* @param {object} data The sheet data.
		* @param {string} [name] The name of the sheet.
		*/
		addSheet(data, name = null) {
			this.#current++;
			if (!name) name = `Sheet${this.#current}`;
			this.#sheets.push({
				name,
				data
			});
		}
		/**
		* Create an xlsx file.
		* @returns {Blob} The xlsx file.
		*/
		create() {
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
					const sheets = this.#sheets.map((sheet, index) => `<sheet name="${sheet.name}" sheetId="${index + 1}" state="visible" r:id="rId${index + 2}"/>`);
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
					if (!this.#sValues.length) this.#sValues.push("No Data");
					const strings = this.#sValues.map((string) => `<si><t>${string}</t></si>`).join("\r\n");
					template = template.replaceAll("{cnt}", `${this.#sValues.length}`);
					template = template.replace("{strings}", strings);
					zip.addFile(filename, template);
					break;
				}
				case "xl/worksheets/sheet1.xml":
					for (const [index, sheet] of this.#sheets.entries()) {
						filename = `xl/worksheets/sheet${index + 1}.xml`;
						const xml = this.#sheetToXml(sheet, template);
						zip.addFile(filename, xml);
					}
					break;
				default: zip.addFile(filename, template);
			}
			return zip.zip();
		}
		/**
		* Convert a sheet object to an XML string.
		* @param {object} sheet The sheet.
		* @param {string} template The XML template.
		* @returns {string} The XML string.
		*/
		#sheetToXml(sheet, template) {
			const colLengths = {};
			const cols = [];
			const rows = [];
			let currentRow = 0;
			const addRow = (data, forceStyle = null) => {
				currentRow++;
				let row = `<row r="${currentRow}">`;
				let currentCol = 0;
				for (let value of data) {
					currentCol++;
					if (currentRow === 1) colLengths[currentCol] = 0;
					if (!value) continue;
					const cName = colName(currentCol) + currentRow;
					value = `${value}`;
					const length = value.length;
					let cType;
					let cStyle;
					let cValue;
					if (value === "0" || /^[-+]?[1-9]\d{0,14}$/.test(value)) {
						cValue = value.trimStart("+");
						if (length > 10) cStyle = 1;
					} else if (/^[-+]?(?:0|[1-9]\d*)\.\d+$/.test(value)) cValue = value.trimStart("+");
					else if (/^[-+]?\d+%$/.test(value)) {
						value = parseInt(value) / 100;
						cValue = value.toFixed(2);
						cStyle = 2;
					} else if (/^[-+]?\d+\.\d+%$/.test(value)) {
						value = Math.round(parseFloat(value) * 100) / 1e4;
						cValue = value.toFixed(4);
						cStyle = 3;
					} else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
						const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
						cValue = formatDate(match[1], match[2], match[3]);
						cStyle = 4;
					} else if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
						const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
						cValue = formatDate(match[3], match[2], match[1]);
						cStyle = 4;
					} else if (/\d{2}:\d{2}:\d{2}$/.test(value)) {
						const match = value.match(/(\d{2}):(\d{2}):(\d{2})$/);
						cValue = formatDate(0, 0, 0, match[1], match[2], match[3]);
						cStyle = 5;
					} else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
						const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
						cValue = formatDate(match[1], match[2], match[3], match[4], match[5], match[6]);
						cStyle = 6;
					} else if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(value)) {
						const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
						cValue = formatDate(match[3], match[2], match[1], match[4], match[5], match[6]);
						cStyle = 6;
					} else if (length > 160) {
						cType = "inlineStr";
						cValue = escape(value);
					} else {
						if (/^[0-9+-.]+$/.test(value)) cStyle = 7;
						cType = "s";
						value = value.trimStart("\0");
						value = escape(value);
						const sKey = `~${value}`;
						if (sKey in this.#sKeys) cValue = this.#sKeys[sKey];
						else {
							this.#sValues.push(value);
							cValue = this.#sValues.length - 1;
							this.#sKeys[sKey] = cValue;
						}
					}
					colLengths[currentCol] = Math.max(length, colLengths[currentCol]);
					const attributes = { r: cName };
					if (cType) attributes.t = cType;
					if (forceStyle) cStyle = forceStyle;
					if (cStyle) attributes.s = cStyle;
					row += `<c ${Object.keys(attributes).map((attr) => `${attr}="${attributes[attr]}"`).join(" ")}>` + (cType === "inlineStr" ? `<is><t>${cValue}</t></is>` : `<v>${cValue}</v>`) + "</c>";
				}
				row += "</row>";
				rows.push(row);
			};
			if (sheet.data.header) addRow(sheet.data.header, 8);
			if (sheet.data.rows) for (const data of sheet.data.rows) addRow(data);
			if (sheet.data.footer) addRow(sheet.data.footer, 8);
			for (const [key, max] of Object.entries(colLengths)) cols.push(`<col min="${key}" max="${key}" width="${Math.min(max + 5, 60)}" />`);
			const ref = `A1:${colName(cols.length)}${rows.length}`;
			template = template.replace("{ref}", ref);
			template = template.replace("{cols}", cols.join("\r\n"));
			template = template.replace("{rows}", rows.join("\r\n"));
			return template;
		}
	};

//#endregion
//#region src/js/buttons.js
/**
	* Generate a CSV file from the table.
	* @param {object} options The button options.
	* @param {object} data The headings and displayed rows.
	* @param {string[]} data.headings The exported headings.
	* @param {Array<Array<*>>} data.rows The displayed row values.
	*/
	function csv(options, { headings, rows: results }) {
		if (!options.title) options.title = _fr0st_query.default.getText("title");
		const rows = [headings, ...results];
		const lines = [];
		for (const row of rows) {
			const line = row.map((value) => {
				value = `${value}`.replace(/"/g, "\"\"");
				if (value.indexOf(",") >= 0) return `"${value}"`;
				return value;
			}).join(",");
			lines.push(line);
		}
		const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
		saveBlob(blob, `${options.title}.csv`);
	}
	/**
	* Generate an excel file from the table.
	* @param {object} options The button options.
	* @param {object} data The headings and displayed rows.
	* @param {string[]} data.headings The exported headings.
	* @param {Array<Array<*>>} data.rows The displayed row values.
	*/
	function excel(options, { headings, rows: results }) {
		if (!options.title) options.title = _fr0st_query.default.getText("title");
		const workbook = new Workbook();
		workbook.addSheet({
			header: headings,
			rows: results
		});
		const blob = workbook.create();
		saveBlob(blob, `${options.title}.xlsx`);
	}
	/**
	* Print the table.
	* @param {object} options The button options.
	* @param {HTMLTableElement} table The table to print.
	* @param {string} classes The table classes.
	*/
	function print(options, table, classes) {
		if (!options.title) options.title = _fr0st_query.default.getText("title");
		const win = window.open("", "");
		win.document.head.innerHTML = `<title>${options.title}</title>`;
		const styles = _fr0st_query.default.find("link, style");
		const newStyles = _fr0st_query.default.clone(styles);
		for (const element of newStyles) {
			if (_fr0st_query.default.tagName(element) === "link") {
				const oldRel = _fr0st_query.default.getAttribute(element, "href");
				const href = new URL(oldRel, document.location).href;
				_fr0st_query.default.setAttribute(element, { href });
			}
			win.document.head.appendChild(element);
		}
		const container = _fr0st_query.default.create("div");
		_fr0st_query.default.addClass(table, classes);
		_fr0st_query.default.append(container, table);
		const tableHtml = _fr0st_query.default.getHtml(container);
		win.document.body.innerHTML = `<h1>${options.title}</h1>${tableHtml}`;
		setTimeout((_) => {
			win.print();
			win.close();
		}, 1e3);
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
	* @property {TableButton[]} [buttons=[]] The export and custom buttons.
	* @property {{top?: string, bottom?: string}} [layout] Comma-separated columns containing pipe-separated controls.
	* @property {Record<string, string|Record<string, string>>} [lang] The interface labels.
	* @property {Record<string, string>} [icons] The pagination icons.
	* @property {'filled'|'outline'} [inputStyle='filled'] The generated input style.
	* @property {TableOrder[]} [order] The initial ordering; defaults to column zero ascending.
	* @property {number[]} [lengths] Available page lengths; defaults to 10, 25, 50, and 100.
	* @property {number} [length=10] The initial page length.
	* @property {number} [debounce=250] The remote request delay in milliseconds.
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
	* @property {function(): void} [preDrawCallback] The pre-draw callback, reserved for the data/lifecycle migration.
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
			bottomRow: "d-md-flex justify-content-between mx-n2",
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
			lengthInputRipple: "ripple-line",
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
			searchInputRipple: "ripple-line",
			table: "table table-bordered",
			tableContainer: "table-responsive",
			tableHeading: "fw-bold",
			tableSort: "table-sort",
			tableSortAsc: "table-sort-asc",
			tableSortDesc: "table-sort-desc",
			topRow: "d-md-flex justify-content-between mb-2 mx-n2"
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
				last: "&raquo",
				next: "&gt;",
				previous: "&lt;"
			},
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
		#filtered;
		#filterIndexes;
		#getData;
		#headings;
		#id;
		#index;
		#infoContainer;
		#lengthSelect;
		#limit;
		#loader;
		#offset;
		#order;
		#original;
		#originalClass;
		#originalDescription;
		#page;
		#pagination;
		#request;
		#results;
		#rowIndexes;
		#searchInput;
		#tbody;
		#term;
		#tfoot;
		#theadRow;
		#total;
		#totalPages;
		/**
		* New Table constructor.
		* @param {HTMLTableElement} node The input table.
		* @param {TableOptions} [options] The component options.
		*/
		constructor(node, options) {
			super(node, options);
			this.#originalClass = _fr0st_query.default.getAttribute(this.node, "class");
			this.#originalDescription = _fr0st_query.default.getAttribute(this.node, "aria-describedby");
			this.#data = [];
			this.#results = [];
			this.#filtered = 0;
			this.#total = 0;
			this.#getData = null;
			let data;
			if (this.options.getResults) this.#getResultsInit();
			else if (_fr0st_query.default._isArray(this.options.data)) data = this.options.data.slice();
			else data = getDataFromDOM(this.node);
			if (data) {
				this.#data = data;
				this.#getDataInit();
			}
			this.#headings = getHeadingsFromDOM(this.node);
			this.#columns = [];
			if (this.options.columns) this.#columns = this.options.columns.map((column) => ({ ...column }));
			else this.#columns = new Array(this.#headings.length).fill();
			this.#columns = this.#columns.map((column, index) => ({
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
			this.#columnCount = this.#columns.reduce((acc, v) => {
				if (v.visible) acc++;
				return acc;
			}, 0);
			this.#offset = 0;
			this.#limit = this.options.paging ? this.options.length : Infinity;
			this.#order = this.options.order.map((order) => [...order]);
			this.#term = null;
			if (!_fr0st_query.default.getAttribute(this.node, "id")) {
				_fr0st_query.default.setAttribute(this.node, { id: (0, _fr0st_ui.generateId)("table") });
				this.#id = true;
			}
			this.#buildIndex();
			this.#render();
			this.#events();
			_fr0st_query.default.triggerEvent(this.node, "init.ui.table");
			this.#getData();
		}
		/**
		* Add a row to the data array.
		* @param {Array|object} row The row to add.
		*/
		addRow(row) {
			this.#data.push(row);
			this.#buildIndex();
			this.#total++;
			this.#filtered++;
			if (this.options.getResults) {
				this.#rowIndexes.push(this.#data.length - 1);
				this.#refreshResults();
				this.#renderResults();
			} else this.#getData();
		}
		/**
		* Clear all rows from the data array.
		*/
		clear() {
			this.#data = [];
			this.#index = [];
			this.#filterIndexes = null;
			this.#rowIndexes = [];
			this.#results = [];
			this.#offset = 0;
			this.#total = 0;
			this.#filtered = 0;
			if (this.options.searching) _fr0st_query.default.setValue(this.#searchInput, "");
			this.#renderResults();
		}
		/**
		* Dispose the Table.
		*/
		dispose() {
			if (!this.node) return;
			if (this.#id) _fr0st_query.default.removeAttribute(this.node, "id");
			for (const [attribute, value] of [["class", this.#originalClass], ["aria-describedby", this.#originalDescription]]) if (value === null || value === void 0) _fr0st_query.default.removeAttribute(this.node, attribute);
			else _fr0st_query.default.setAttribute(this.node, { [attribute]: value });
			_fr0st_query.default.before(this.#container, this.node);
			_fr0st_query.default.remove(this.#container);
			_fr0st_query.default.empty(this.node);
			for (const child of _fr0st_query.default.children(this.#original)) _fr0st_query.default.append(this.node, child);
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
			this.#columns = null;
			this.#headings = null;
			this.#order = null;
			this.#data = null;
			this.#index = null;
			this.#filterIndexes = null;
			this.#rowIndexes = null;
			this.#results = null;
			this.#request = null;
			this.#getData = null;
			super.dispose();
		}
		/**
		* Get values for a single column.
		* @param {string} key The key to retrieve.
		* @param {object} [options] Options for getting the column.
		* @param {boolean} [options.modified=true] Whether to use modified indexes.
		* @returns {Array} The column values.
		*/
		getColumn(key, { modified = true } = {}) {
			return modified ? this.#rowIndexes.map((rowIndex) => _fr0st_query.default._getDot(this.#data[rowIndex], `${key}`)) : this.#data.map((row) => _fr0st_query.default._getDot(row, `${key}`));
		}
		/**
		* Get values for a single row.
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
		* Get a single value from a row.
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
		* Toggle a column as hidden.
		* @param {number} index The column index.
		*/
		hideColumn(index) {
			this.#columns[index].visible = false;
			this.#renderResults();
		}
		/**
		* Get the Table information.
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
		* Set the Table length.
		* @param {number} length The length.
		*/
		length(length) {
			if (!this.options.paging) return;
			this.#limit = length;
			this.#offset -= this.#offset % this.#limit;
			_fr0st_query.default.triggerEvent(this.node, "length.ui.table");
			this.#getData();
		}
		/**
		* Trigger the loading indicator.
		* @param {object} [options] Options for the loading indicator.
		* @param {boolean} [options.show=true] Whether to show the loading indicator.
		*/
		loading({ show = true } = {}) {
			if (show) {
				_fr0st_query.default.triggerEvent(this.node, "processing.ui.table");
				_fr0st_query.default.show(this.#loader);
			} else {
				_fr0st_query.default.hide(this.#loader);
				_fr0st_query.default.triggerEvent(this.node, "processed.ui.table");
			}
		}
		/**
		* Set the Table order data.
		* @param {Array} order The order data.
		*/
		order(order) {
			if (!this.options.ordering) return;
			this.#order = order;
			_fr0st_query.default.triggerEvent(this.node, "order.ui.table");
			this.#getData();
		}
		/**
		* Set the Table page.
		* @param {number} page The one-based page number.
		*/
		page(page) {
			if (!this.options.paging) return;
			this.#offset = (page - 1) * this.#limit;
			_fr0st_query.default.triggerEvent(this.node, "page.ui.table");
			this.#getData();
		}
		/**
		* Redraw the Table.
		*/
		refresh() {
			this.#renderResults();
		}
		/**
		* Reload the Table data.
		* @param {object} [options] Options for reloading the data
		* @param {boolean} [options.reset=false] Whether to reset the offset.
		*/
		reload({ reset = false } = {}) {
			if (reset) this.#offset = 0;
			this.#getData();
		}
		/**
		* Remove a row from the data array.
		* @param {number} index The row index to remove.
		* @param {object} [options] Options for getting the row index.
		* @param {boolean} [options.modified=true] Whether to use modified indexes.
		*/
		removeRow(index, { modified = true } = {}) {
			const rowIndex = this.#getIndex(index, { modified });
			this.#data = this.#data.filter((_, dataIndex) => dataIndex !== rowIndex);
			this.#buildIndex();
			this.#refreshResults();
			this.#renderResults();
		}
		/**
		* Search the Table for a term.
		* @param {string} term The term to search for.
		*/
		search(term) {
			if (!this.options.searching) return;
			_fr0st_query.default.setValue(this.#searchInput, term);
			this.#term = term;
			_fr0st_query.default.triggerEvent(this.node, "search.ui.table");
			if (this.options.getResults) {
				this.#getData();
				return;
			}
			if (this.#term) {
				this.#filterIndexes = [];
				const escapedFilter = _fr0st_query.default._escapeRegExp(this.#term);
				const regExp = new RegExp(escapedFilter, "i");
				for (const [index, result] of this.#data.entries()) for (const column of this.#columns) {
					if (!column.searchable) continue;
					const value = _fr0st_query.default._getDot(result, `${column.data}`);
					if (regExp.test(value)) this.#filterIndexes.push(index);
				}
				this.#filtered = this.#filterIndexes.length;
			} else {
				this.#filterIndexes = null;
				this.#filtered = this.#total;
			}
			this.#getData();
		}
		/**
		* Set values for a single column.
		* @param {string} key The key to set.
		* @param {Array} column The column values.
		* @param {object} [options] Options for getting the row index.
		* @param {boolean} [options.modified=true] Whether to use modified indexes.
		*/
		setColumn(key, column, { modified = true } = {}) {
			this.#data = this.#data.map((row, index) => {
				const rowIndex = modified ? this.#rowIndexes.findIndex((otherIndex) => otherIndex == index) : index;
				if (rowIndex >= 0) _fr0st_query.default._setDot(row, `${key}`, column[rowIndex]);
				return row;
			});
			this.#buildIndex();
			this.#refreshResults();
			this.#renderResults();
		}
		/**
		* Set values for a single row.
		* @param {number} index The row index to set.
		* @param {Array|object} row The row values.
		* @param {object} [options] Options for getting the row index.
		* @param {boolean} [options.modified=true] Whether to use modified indexes.
		*/
		setRow(index, row, { modified = true } = {}) {
			const rowIndex = this.#getIndex(index, { modified });
			this.#data[rowIndex] = row;
			this.#buildIndex();
			this.#refreshResults();
			this.#renderResults();
		}
		/**
		* Set a single value for a row.
		* @param {number} index The row index to set.
		* @param {string} key The key to set.
		* @param {*} value The value to set.
		* @param {object} [options] Options for getting the row index.
		* @param {boolean} [options.modified=true] Whether to use modified indexes.
		*/
		setValue(index, key, value, { modified = true } = {}) {
			const rowIndex = this.#getIndex(index, { modified });
			_fr0st_query.default._setDot(this.#data[rowIndex], `${key}`, value);
			this.#buildIndex();
			this.#refreshResults();
			this.#renderResults();
		}
		/**
		* Toggle a column as visible.
		* @param {number} index The column index.
		*/
		showColumn(index) {
			this.#columns[index].visible = true;
			this.#renderResults();
		}
		/**
		* Rebuild the index.
		*/
		#buildIndex() {
			if (this.options.getResults || !this.options.ordering) return;
			this.#index = [];
			for (const column of this.#columns) {
				if (!column.orderable) continue;
				this.#index[column.data] = [];
				const valueLookup = {};
				for (const [index, result] of this.#data.entries()) {
					const value = _fr0st_query.default._getDot(result, `${column.data}`);
					if (!(value in valueLookup)) valueLookup[value] = [];
					valueLookup[value].push(index);
				}
				const values = Object.keys(valueLookup).sort((a, b) => {
					if (_fr0st_query.default._isNumeric(a) && _fr0st_query.default._isNumeric(b)) return a - b;
					const aLower = a.toLowerCase();
					const bLower = b.toLowerCase();
					return aLower.localeCompare(bLower);
				});
				for (const value of values) this.#index[column.data].push(valueLookup[value]);
			}
		}
		/**
		* Render a table for specific columns.
		* @param {Array} columns The columns to render.
		* @returns {HTMLElement} The table element.
		*/
		#buildTable(columns) {
			const table = _fr0st_query.default.create("table");
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
		* Attach events for the Table.
		*/
		#events() {
			if (this.options.lengthChange) _fr0st_query.default.addEvent(this.#lengthSelect, "change.ui.table", (_) => {
				const length = _fr0st_query.default.getValue(this.#lengthSelect);
				this.length(length);
			});
			if (this.options.searching) _fr0st_query.default.addEvent(this.#searchInput, "input.ui.table", _fr0st_query.default._debounce((_) => {
				const term = _fr0st_query.default.getValue(this.#searchInput);
				this.search(term);
			}));
			if (this.options.ordering) {
				const handleSort = (e) => {
					const index = _fr0st_query.default.index(e.currentTarget);
					if (!this.#columns[index].orderable) return;
					e.preventDefault();
					const defaultDir = this.#columns[index].dir;
					let currentDir = null;
					for (const [col, dir] of this.#order) {
						if (col != index) continue;
						currentDir = dir;
						break;
					}
					let nextDir = defaultDir;
					if (currentDir === defaultDir) nextDir = defaultDir === "asc" ? "desc" : "asc";
					let order;
					if (e.shiftKey) {
						if (!currentDir) order = [...this.#order, [index, nextDir]];
						else if (currentDir === defaultDir) order = this.#order.map(([col, dir]) => {
							if (col == index) dir = nextDir;
							return [col, dir];
						});
						else order = this.#order.filter(([col]) => {
							return col != index;
						});
					} else order = [[index, nextDir]];
					this.order(order);
				};
				_fr0st_query.default.addEventDelegate(this.#theadRow, "click.ui.table", "th", handleSort);
				_fr0st_query.default.addEventDelegate(this.#theadRow, "keydown.ui.table", "th", (e) => {
					switch (e.code) {
						case "Enter":
						case "NumpadEnter":
						case "Space": handleSort(e);
					}
				});
			}
			if (this.options.paging) _fr0st_query.default.addEventDelegate(this.#pagination, "click.ui.table", "[data-ui-page]", (e) => {
				e.preventDefault();
				let page = _fr0st_query.default.getDataset(e.currentTarget, "uiPage");
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
		* Initialize preloaded get data.
		*/
		#getDataInit() {
			this.#total = this.#data.length;
			this.#filtered = this.#total;
			this.#getData = (_) => {
				this.loading();
				this.#rowIndexes = this.#filterIndexes;
				if (this.options.ordering) {
					const order = this.#getOrder();
					this.#rowIndexes = this.#getOrderedIndexes(order, this.#rowIndexes);
				}
				if (!this.#rowIndexes) this.#rowIndexes = _fr0st_query.default._range(this.#offset, this.#offset + this.#limit);
				this.loading({ show: false });
				this.#refreshResults();
				this.#renderResults();
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
		* Get headings for specific columns.
		* @param {Array} columns The columns to get.
		* @returns {Array} The headings.
		*/
		#getHeadings(columns) {
			const headings = [];
			for (const [index, heading] of this.#headings.entries()) {
				if (!columns.includes(index)) continue;
				headings.push(heading.text);
			}
			return headings;
		}
		/**
		* Get an index (optionally modified).
		* @param {number} index The index to get.
		* @param {object} [options] Options for getting the row index.
		* @param {boolean} [options.modified=true] Whether to use modified indexes.
		* @returns {number} The index.
		*/
		#getIndex(index, { modified = true } = {}) {
			return modified ? this.#rowIndexes[index] : index;
		}
		/**
		* Get real column ordering data.
		* @returns {Array} The column ordering data.
		*/
		#getOrder() {
			const order = [];
			for (const [index, direction] of this.#order) if (this.#columns[index].orderData) order.push(...this.#columns[index.orderData]);
			else order.push([index, direction]);
			return order;
		}
		/**
		* Get a range of data indexes for filtered rows, based on order data.
		* @param {Array} order The order data.
		* @param {Array} [onlyRows=null] The filtered rows.
		* @param {number} [offset] The starting offset.
		* @param {number} [limit] The maximum rows to return.
		* @param {number} [orderIndex=0] The order index.
		* @returns {Array} The data indexes.
		*/
		#getOrderedIndexes(order, onlyRows = null, offset = this.#offset, limit = this.#limit, orderIndex = 0) {
			const [index, direction] = order[orderIndex];
			const key = this.#columns[index].data;
			let rowLookup = this.#index[key];
			if (direction === "desc") rowLookup = rowLookup.slice().reverse();
			let current = 0;
			const results = [];
			for (const rows of rowLookup) {
				let filteredRows = onlyRows ? rows.filter((row) => onlyRows.includes(row)) : rows;
				if (direction === "desc") filteredRows = filteredRows.slice().reverse();
				if (offset > current + filteredRows.length || !filteredRows.length) {
					current += rows.length;
					continue;
				}
				const sortedRows = filteredRows.length > 1 && orderIndex < order.length - 1 ? this.#getOrderedIndexes(order, filteredRows, 0, Math.min(filteredRows.length, limit - results.length), orderIndex + 1) : rows;
				for (const row of sortedRows) {
					current++;
					if (current <= offset) continue;
					results.push(row);
					if (results.length == limit) return results;
				}
			}
			return results;
		}
		/**
		* Get results for specific columns.
		* @param {Array} columns The columns to get.
		* @returns {Array} The results.
		*/
		#getResultRows(columns) {
			const rows = [];
			for (const result of this.#results) {
				const row = [];
				for (const [index, column] of this.#columns.entries()) {
					if (!columns.includes(index)) continue;
					const value = _fr0st_query.default._getDot(result, `${column.data}`);
					row.push(value);
				}
				rows.push(row);
			}
			return rows;
		}
		/**
		* Initialize get data from callback.
		*/
		#getResultsInit() {
			const load = _fr0st_query.default._debounce(() => {
				const options = {};
				if (this.#term) options.term = this.#term;
				if (this.options.ordering) options.order = { ...this.#order.map(([column, dir]) => ({
					column,
					dir
				})) };
				if (this.options.paging) {
					options.offset = this.#offset;
					options.limit = this.#limit;
				}
				options.columns = { ...this.#columns.map((column) => {
					const data = {};
					if (column.name) data.name = column.name;
					return {
						...data,
						data: column.data,
						orderable: column.orderable,
						searchable: column.searchable
					};
				}) };
				const request = Promise.resolve(this.options.getResults(options));
				request.then((response) => {
					if (this.#request !== request) return;
					this.#total = response.total;
					this.#filtered = response.filtered;
					this.#data = response.results;
					this.#refreshResults();
					this.#rowIndexes = _fr0st_query.default._range(0, this.#results.length - 1);
					this.loading({ show: false });
					this.#renderResults();
					this.#request = null;
				}).catch((_) => {
					if (this.#request !== request) return;
					this.loading({ show: false });
					this.#request = null;
				});
				this.#request = request;
			}, this.options.debounce);
			this.#getData = (_) => {
				if (this.#request && this.#request.cancel) this.#request.cancel();
				this.#request = null;
				this.loading();
				load();
			};
		}
		/**
		* Get the visible columns.
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
		* Refresh the results.
		*/
		#refreshResults() {
			if (this.options.getResults) this.#results = this.#data;
			else this.#results = this.#rowIndexes.map((rowIndex) => this.#data[rowIndex]);
			if (this.options.paging) {
				this.#page = 1 + this.#offset / this.#limit;
				this.#totalPages = Math.ceil(this.#filtered / this.#limit) || 1;
			}
		}
		/**
		* Render the Table.
		*/
		#render() {
			this.#original = _fr0st_query.default.clone(this.node);
			_fr0st_query.default.empty(this.node);
			this.#container = _fr0st_query.default.create("div", { class: this.constructor.classes.container });
			this.#loader = _fr0st_query.default.create("div", { class: this.constructor.classes.loader });
			const loaderIcon = _fr0st_query.default.create("span", { class: this.constructor.classes.loaderIcon });
			_fr0st_query.default.append(this.#loader, loaderIcon);
			_fr0st_query.default.addClass(this.node, this.constructor.classes.table);
			const thead = _fr0st_query.default.create("thead");
			_fr0st_query.default.append(this.node, thead);
			this.#theadRow = _fr0st_query.default.create("tr");
			_fr0st_query.default.append(thead, this.#theadRow);
			this.#tbody = _fr0st_query.default.create("tbody");
			_fr0st_query.default.append(this.node, this.#tbody);
			const tfoot = _fr0st_query.default.findOne("tfoot", this.#original);
			if (tfoot) {
				this.#tfoot = _fr0st_query.default.clone(tfoot);
				_fr0st_query.default.append(this.node, this.#tfoot);
			}
			_fr0st_query.default.hide(this.#loader);
			_fr0st_query.default.after(this.node, this.#container);
			_fr0st_query.default.append(this.#container, this.#loader);
			if (this.options.layout.top) this.#renderLayoutRow(this.options.layout.top, this.constructor.classes.topRow);
			const tableContainer = _fr0st_query.default.create("div", { class: this.constructor.classes.tableContainer });
			_fr0st_query.default.append(tableContainer, this.node);
			_fr0st_query.default.append(this.#container, tableContainer);
			if (this.options.layout.bottom) this.#renderLayoutRow(this.options.layout.bottom, this.constructor.classes.bottomRow);
			if (this.#infoContainer) _fr0st_query.default.setAttribute(this.node, { "aria-describedby": _fr0st_query.default.getAttribute(this.#infoContainer, "id") });
		}
		/**
		* Render the table buttons.
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
				_fr0st_query.default.addEvent(btn, "click.ui.table", (e) => {
					e.preventDefault();
					if (button.callback) button.callback.bind(this)();
					else if (button.type in this.constructor.buttons) this.constructor.buttons[button.type].bind(this)(button);
				});
				_fr0st_query.default.append(btnGroup, btn);
			}
			_fr0st_query.default.append(container, btnGroup);
		}
		/**
		* Render the table headings.
		*/
		#renderHeadings() {
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
					cell = _fr0st_query.default.create("th", {
						class: this.constructor.classes.tableHeading,
						html: heading.text,
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
					if (!lastCell) _fr0st_query.default.append(this.#theadRow, cell);
					else _fr0st_query.default.insertAfter(cell, lastCell);
				}
				lastCell = cell;
				if (!this.options.ordering || !this.#columns[index].orderable) continue;
				let dir;
				for (const order of this.#order) {
					if (order[0] != index) continue;
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
		* Render the table info.
		*/
		#renderInfo() {
			_fr0st_query.default.empty(this.#infoContainer);
			const start = this.#offset + 1;
			const end = this.#offset + this.#results.length;
			let infoText = this.#filtered < this.#total ? this.options.lang.infoFiltered : this.options.lang.info;
			const replacements = {
				start,
				end,
				filtered: this.#filtered,
				total: this.#total
			};
			for (const [key, value] of Object.entries(replacements)) infoText = infoText.replace(`{${key}}`, value);
			if (this.options.infoCallback) infoText = this.options.infoCallback(start, end, this.#total, this.#filtered, infoText);
			const text = _fr0st_query.default.create("small", { text: infoText });
			_fr0st_query.default.append(this.#infoContainer, text);
		}
		/**
		* Render the table info container in a container.
		* @param {HTMLElement} container The container to render in.
		*/
		#renderInfoContainer(container) {
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
		* Render a layout row in a container.
		* @param {Array} columns The columns to render.
		* @param {string} rowClass The row class.
		*/
		#renderLayoutRow(columns, rowClass) {
			const row = _fr0st_query.default.create("div", { class: rowClass });
			for (const elements of columns.split(",")) {
				const column = _fr0st_query.default.create("div", { class: this.constructor.classes.column });
				for (const element of elements.split("|")) {
					if (!(element in this.constructor.layout)) continue;
					const container = _fr0st_query.default.create("div", { class: this.constructor.classes.columnContainer });
					this.constructor.layout[element].bind(this)(container);
					_fr0st_query.default.append(column, container);
				}
				_fr0st_query.default.append(row, column);
			}
			_fr0st_query.default.append(this.#container, row);
		}
		/**
		* Render the length select in a container.
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
				if (length == this.#limit) _fr0st_query.default.setAttribute(option, { checked: true });
				_fr0st_query.default.append(this.#lengthSelect, option);
			}
			if (this.options.inputStyle === "filled") {
				const ripple = _fr0st_query.default.create("div", { class: this.constructor.classes.lengthInputRipple });
				_fr0st_query.default.append(inputContainer, ripple);
			}
			_fr0st_query.default.append(container, lengthContainer);
		}
		/**
		* Render a pagination item.
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
					"role": "link",
					"aria-controls": _fr0st_query.default.getAttribute(this.node, "id")
				},
				dataset: { uiPage: options.page }
			});
			_fr0st_query.default.append(container, link);
			return container;
		}
		/**
		* Render the pagination.
		*/
		#renderPagination() {
			const setDisabled = (container, disabled) => {
				const link = _fr0st_query.default.findOne(":scope > [data-ui-page]", container);
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
			setDisabled(firstPage, this.#page == 1);
			setDisabled(prevPage, this.#page == 1);
			setDisabled(nextPage, this.#page == this.#totalPages);
			setDisabled(lastPage, this.#page == this.#totalPages);
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
				if (current == this.#page) _fr0st_query.default.addClass(pageItem, this.constructor.classes.pageActive);
				else _fr0st_query.default.removeClass(pageItem, this.constructor.classes.pageActive);
				lastLink = pageItem;
			}
		}
		/**
		* Render the pagination container in a container.
		* @param {HTMLElement} container The container to render in.
		*/
		#renderPaginationContainer(container) {
			const paginationContainer = _fr0st_query.default.create("div", { class: this.constructor.classes.paginationContainer });
			_fr0st_query.default.append(container, paginationContainer);
			this.#pagination = _fr0st_query.default.create("div", { class: this.constructor.classes.pagination });
			_fr0st_query.default.append(paginationContainer, this.#pagination);
		}
		/**
		* Render the table results.
		*/
		#renderResults() {
			_fr0st_query.default.triggerEvent(this.node, "preDraw.ui.table");
			_fr0st_query.default.empty(this.#tbody);
			this.#renderHeadings();
			if (this.options.headerCallback) this.options.headerCallback(this.#theadRow, this.#data, this.#offset, this.#offset + this.#limit, this.#rowIndexes);
			if (this.options.paging) this.#renderPagination();
			if (this.options.info) this.#renderInfo();
			if (!this.#results.length) {
				const row = _fr0st_query.default.create("tr");
				const cell = _fr0st_query.default.create("td", {
					class: this.constructor.classes.emptyCell,
					html: this.#term ? this.options.lang.noResults : this.options.lang.noData,
					attributes: { colspan: this.#columnCount }
				});
				_fr0st_query.default.append(row, cell);
				_fr0st_query.default.append(this.#tbody, row);
			} else for (const [index, result] of this.#results.entries()) {
				const row = this.#renderRow(result, index);
				if (this.options.rowCallback) this.options.rowCallback(row, result, index, this.#offset + index, this.#rowIndexes[index]);
				_fr0st_query.default.append(this.#tbody, row);
				if (this.options.createdRow) this.options.createdRow(row, result, index);
			}
			if (this.options.drawCallback) this.options.drawCallback();
			if (this.#tfoot && this.options.footerCallback) this.options.footerCallback(this.#tfoot, this.#data, this.#offset, this.#offset + this.#limit, this.#rowIndexes);
			_fr0st_query.default.triggerEvent(this.node, "draw.ui.table");
		}
		/**
		* Render a result row.
		* @param {Array|object} data The row data.
		* @param {number} rowIndex The row index.
		* @returns {HTMLElement} The table row.
		*/
		#renderRow(data, rowIndex) {
			const row = _fr0st_query.default.create("tr");
			for (const [index, column] of this.#columns.entries()) {
				if (!column.visible) continue;
				const value = _fr0st_query.default._getDot(data, `${column.data}`);
				const cell = _fr0st_query.default.create("td", { html: column.format ? column.format(value) : value });
				if (column.class) _fr0st_query.default.addClass(column.class);
				if (column.createdCell) column.createdCell(cell, value, data, rowIndex, index);
				_fr0st_query.default.append(row, cell);
			}
			return row;
		}
		/**
		* Render the search in a container.
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
					"aria-controls": _fr0st_query.default.getAttribute(this.node, "id")
				}
			});
			_fr0st_query.default.append(inputContainer, this.#searchInput);
			if (this.options.inputStyle === "filled") {
				const ripple = _fr0st_query.default.create("div", { class: this.constructor.classes.searchInputRipple });
				_fr0st_query.default.append(inputContainer, ripple);
			}
			_fr0st_query.default.append(container, searchContainer);
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