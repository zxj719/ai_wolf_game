import { execFileSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { createConnection } from 'net';

const SERVICE_PORT = 8080;
const SERVICE_DIR = 'cloud/chords_service';

function checkPort(port) {
  return new Promise((res) => {
    const conn = createConnection({ port, host: '127.0.0.1' }, () => {
      conn.destroy();
      res(true);
    });
    conn.on('error', () => res(false));
    conn.setTimeout(800, () => { conn.destroy(); res(false); });
  });
}

function hasUvicorn(pythonPath) {
  try {
    execFileSync(pythonPath, ['-c', 'import uvicorn'], {
      timeout: 5000, stdio: 'ignore',
    });
    return true;
  } catch { return false; }
}

function findPython(serviceDir) {

  const venvCandidates = process.platform === 'win32'
    ? [join(serviceDir, '.venv', 'Scripts', 'python.exe')]
    : [join(serviceDir, '.venv', 'bin', 'python3'), join(serviceDir, '.venv', 'bin', 'python')];

  const venvHit = venvCandidates.find((p) => existsSync(p));
  if (venvHit && hasUvicorn(venvHit)) return { path: venvHit, source: 'venv' };

  const systemNames = process.platform === 'win32'
    ? ['python', 'python3']
    : ['python3', 'python'];

  for (const name of systemNames) {
    try {
      const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], {
        encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\r?\n/)[0];
      if (out && existsSync(out) && hasUvicorn(out)) return { path: out, source: 'system' };
    } catch {}
  }

  return null;
}

export default function chordsServicePlugin() {
  let child = null;

  function kill() {
    if (!child) return;
    const pid = child.pid;
    child.removeAllListeners();
    if (process.platform === 'win32') {
      try { spawn('taskkill', ['/pid', String(pid), '/f', '/t'], { stdio: 'ignore' }); } catch {}
    } else {
      try { process.kill(-pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    }
    child = null;
  }

  return {
    name: 'vite-plugin-chords-service',
    apply: 'serve',

    configureServer(server) {
      const root = server.config.root || process.cwd();
      const serviceDir = resolve(root, SERVICE_DIR);
      const log = server.config.logger;

      const hit = findPython(serviceDir);
      if (!hit) {
        log.warn(
          '\x1b[33m[chords] No Python found — skipping auto-start.\x1b[0m\n' +
          '         Install Python 3.10+ and pip install -r cloud/chords_service/requirements.txt',
        );
        return;
      }
      const python = hit.path;
      log.info(`\x1b[36m[chords]\x1b[0m Using ${hit.source} Python: ${python}`);

      checkPort(SERVICE_PORT).then((inUse) => {
        if (inUse) {
          log.info(`\x1b[36m[chords]\x1b[0m Port ${SERVICE_PORT} already in use — assuming service is running.`);
          return;
        }

        log.info(`\x1b[36m[chords]\x1b[0m Starting uvicorn on port ${SERVICE_PORT}...`);

        child = spawn(
          python,
          ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(SERVICE_PORT)],
          {
            cwd: serviceDir,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: process.platform !== 'win32',
          },
        );

        child.stdout.on('data', (d) => {
          for (const line of d.toString().split('\n').filter(Boolean))
            log.info(`\x1b[36m[chords]\x1b[0m ${line}`);
        });

        child.stderr.on('data', (d) => {
          for (const line of d.toString().split('\n').filter(Boolean))
            log.info(`\x1b[36m[chords]\x1b[0m ${line}`);
        });

        child.on('exit', (code) => {
          if (code && code !== 0)
            log.warn(`\x1b[33m[chords]\x1b[0m uvicorn exited with code ${code}`);
          child = null;
        });
      });

      const cleanup = () => kill();
      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      server.httpServer?.on('close', cleanup);
    },
  };
}
