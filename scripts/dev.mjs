import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const apiPort = Number(process.env.PORT) || 3001;
const webPort = 5173;

async function portAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', error => error.code === 'EADDRINUSE' ? resolve(false) : reject(error));
    probe.listen(port, host, () => probe.close(() => resolve(true)));
  });
}

async function isJobConnect(port) {
  try {
    const response = await fetch(`http://${host}:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok && (await response.json()).service === 'jobconnect';
  } catch {
    return false;
  }
}

let backend;
let web;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.allSettled([
    web?.close(),
    backend ? new Promise(resolve => {
      backend.close(resolve);
      backend.closeAllConnections();
    }) : undefined,
  ]);
  process.exitCode = code;
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

try {
  const [apiFree, webFree] = await Promise.all([portAvailable(apiPort), portAvailable(webPort)]);
  if (!apiFree && !webFree && await isJobConnect(apiPort) && await isJobConnect(webPort)) {
    console.log(`JobConnect đang chạy: http://${host}:${webPort}/`);
    console.log('Không cần chạy thêm phiên. Hãy mở địa chỉ trên trong trình duyệt.');
  } else {
    if (!webFree) throw new Error(`Cổng ${webPort} đang được sử dụng. Dừng terminal chạy frontend cũ (Ctrl+C) rồi chạy lại npm run dev.`);
    const reuseBackend = !apiFree && await isJobConnect(apiPort);
    if (!apiFree && !reuseBackend) throw new Error(`Cổng ${apiPort} đang được sử dụng. Dừng terminal backend cũ (Ctrl+C), hoặc đặt PORT khác rồi chạy lại npm run dev.`);
    if (!reuseBackend) {
      const { createApp } = await import('../backend/server.mjs');
      backend = createApp().server;
      await new Promise((resolve, reject) => {
        backend.once('error', reject);
        backend.listen(apiPort, host, resolve);
      });
      console.log(`JobConnect API: http://${host}:${apiPort}`);
    } else {
      console.log(`Sử dụng backend JobConnect đang chạy trên cổng ${apiPort}.`);
    }
    const { createServer } = await import('../frontend/node_modules/vite/dist/node/index.js');
    web = await createServer({
      root: fileURLToPath(new URL('../frontend/', import.meta.url)),
      server: { host, port: webPort, strictPort: true },
    });
    await web.listen();
    web.printUrls();
    console.log('Nhấn Ctrl+C để dừng ứng dụng. Khi sửa mã backend, hãy khởi động lại lệnh này.');
  }
} catch (error) {
  console.error(`Không thể khởi động JobConnect: ${error.message}`);
  await stop(1);
}
