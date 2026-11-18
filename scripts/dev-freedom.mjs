import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {DIST} from '../.claude/skills/teardown/paths.mjs';
import {join} from 'node:path';

const run = promisify(execFile);
const builder = fileURLToPath(new URL('../.claude/skills/teardown/sims/build.mjs', import.meta.url));
const host = '127.0.0.1';
const port = 8791;
let build;

const buildPage = () => {
  build ??= run(process.execPath, [builder, './sims/freedom-live'])
    .then(() => readFile(join(DIST, 'freedom-live.html')))
    .finally(() => { build = undefined; });
  return build;
};

await buildPage();
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname !== '/' && pathname !== '/freedom-live.html') {
    response.writeHead(404).end();
    return;
  }
  try {
    const page = await buildPage();
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
    response.end(page);
  } catch (error) {
    console.error(error.stderr || error.message);
    response.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
    response.end(error.stderr || error.message);
  }
}).listen(port, host, () => console.log(`Freedom preview: http://${host}:${port}/`));
