import { expect, test } from '@playwright/test';
import Workbook from '../../src/js/workbook/workbook.js';
import { readZip } from '../support/exports.js';

test.describe('Workbook', () => {
    test('escapes duplicate sheet names and recreates the archive without stale strings', async () => {
        const workbook = new Workbook();
        workbook.addSheet({ rows: [['first', 'first']] }, 'A & "B"');
        workbook.addSheet({ rows: [['second']] }, 'A & "B"');

        // Reusing the same instance checks that shared strings reset between archives.
        for (let index = 0; index < 2; index++) {
            const files = readZip(new Uint8Array(await workbook.create().arrayBuffer()));
            const xml = files.get('xl/workbook.xml').text;
            const names = [...xml.matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);

            expect(names).toEqual(['A &amp; &quot;B&quot;', 'A &amp; &quot;B&quot; (1)']);
            expect(files.get('xl/sharedStrings.xml').text).toContain('count="3" uniqueCount="2"');
            expect(files.has('xl/worksheets/sheet2.xml')).toBe(true);
        }
    });
});
