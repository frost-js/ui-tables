import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const css = 'text/css; charset=utf-8';
const html = 'text/html; charset=utf-8';
const javaScript = 'text/javascript; charset=utf-8';
const resolveModule = (specifier) => new URL(import.meta.resolve(specifier));

const routes = new Map([
    ['/', { contentType: html, file: new URL('../app/index.html', import.meta.url) }],
    ['/esm.html', { contentType: html, file: new URL('../app/esm.html', import.meta.url) }],
    ['/umd-min.html', { contentType: html, file: new URL('../app/umd-min.html', import.meta.url) }],
    ['/assets/frost-ui-tables.js', { contentType: javaScript, file: new URL('../../../dist/frost-ui-tables.js', import.meta.url) }],
    ['/assets/frost-ui-tables.css', { contentType: css, file: new URL('../../../dist/frost-ui-tables.css', import.meta.url) }],
    ['/assets/frost-ui-bundle.js', { contentType: javaScript, file: resolveModule('@fr0st/ui/dist/frost-ui-bundle.js') }],
    ['/assets/frost-ui.css', { contentType: css, file: resolveModule('@fr0st/ui/dist/frost-ui.css') }],
]);

for (const filename of ['frost-ui-tables.esm.js', 'frost-ui-tables.esm.min.js', 'frost-ui-tables.min.js']) {
    routes.set(`/assets/${filename}`, {
        contentType: javaScript,
        file: new URL(`../../../dist/${filename}`, import.meta.url),
    });
}

for (const [filename, specifier] of [
    ['frost-core.esm.js', '@fr0st/core'],
    ['fquery.esm.js', '@fr0st/query'],
    ['frost-ui.esm.js', '@fr0st/ui'],
]) {
    routes.set(`/assets/${filename}`, { contentType: javaScript, file: resolveModule(specifier) });
}

const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const route = routes.get(url.pathname);

    if (!route) {
        response.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8',
        });
        response.end('Not found');
        return;
    }

    try {
        const data = await readFile(route.file);

        response.writeHead(200, {
            'Content-Type': route.contentType,
        });
        response.end(data);
    } catch {
        response.writeHead(500, {
            'Content-Type': 'text/plain; charset=utf-8',
        });
        response.end('Internal server error');
    }
});

server.listen(Number(process.env.PORT ?? 3001));
