import { expect, test } from '@playwright/test';
import Zip from '../../src/js/zip/zip.js';
import { readZip } from '../support/exports.js';

test.describe('Zip', () => {
    for (const { name, filename, text, method } of [
        { name: 'stored', filename: 'café.txt', text: '123456789', method: 0 },
        { name: 'compressed', filename: 'compressed.txt', text: 'abcdefghijklmnopqrstuvwxyz'.repeat(3000), method: 8 },
    ]) {
        test(`round-trips ${name} entries with UTF-8 names and DOS dates`, async () => {
            const zip = new Zip();
            zip.addFile(filename, text);
            zip.addFile('readme.txt', 'A second entry');

            const bytes = new Uint8Array(await zip.zip().arrayBuffer());
            const files = readZip(bytes);
            const file = files.get(filename);

            expect(files.size).toBe(2);
            expect(file.text).toBe(text);
            expect(file.flags & 0x0800).toBe(0x0800);
            expect(file.method).toBe(method);
            expect((file.date >> 9) + 1980).toBe(new Date().getFullYear());
            expect(files.get('readme.txt').text).toBe('A second entry');
            expect(files.get('readme.txt').method).toBe(0);
        });
    }
});
