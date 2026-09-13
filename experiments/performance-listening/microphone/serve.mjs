import { createServer } from "vite";
import { fileURLToPath } from "node:url";
const server = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  server: {
    host: "127.0.0.1",
    port: Number(process.env.PORT ?? 5175),
    strictPort: true,
  },
});
await server.listen();
console.log(
  `Microphone test: http://127.0.0.1:${server.httpServer.address().port}/microphone/`,
);
