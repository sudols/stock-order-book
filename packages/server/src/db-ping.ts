import net from "node:net";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export async function pingPostgres(
  host = process.env.POSTGRES_HOST || "127.0.0.1",
  port = Number(process.env.POSTGRES_PORT) || 5432,
  timeoutMs = 3000
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      // Send PostgreSQL SSLRequest message: length 8, code 80877103 (1234.5679)
      const sslRequest = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);
      socket.write(sslRequest);
    });

    socket.setTimeout(timeoutMs);

    socket.on("data", (data) => {
      // PostgreSQL responds with 'S' (SSL supported) or 'N' (SSL not supported)
      const response = data.toString("utf8");
      if (response === "S" || response === "N") {
        socket.end();
        resolve(true);
      } else {
        socket.destroy();
        reject(new Error(`Unexpected response from server: ${response}`));
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Connection to PostgreSQL at ${host}:${port} timed out after ${timeoutMs}ms`));
    });

    socket.on("error", (err) => {
      reject(err);
    });
  });
}

// If executed directly via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.POSTGRES_HOST || "127.0.0.1";
  const port = Number(process.env.POSTGRES_PORT) || 5432;
  console.log(`Pinging PostgreSQL database at ${host}:${port}...`);
  pingPostgres(host, port)
    .then(() => {
      console.log(`✅ Successfully connected and verified PostgreSQL wire protocol on ${host}:${port}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`❌ Failed to connect to PostgreSQL:`, err.message);
      process.exit(1);
    });
}
