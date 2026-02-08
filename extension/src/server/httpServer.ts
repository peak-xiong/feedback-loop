/**
 * HTTP server for receiving MCP requests
 */
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { PORT_FILE_DIR } from "../core/config";
import { AskRequest } from "../types";

let server: http.Server | null = null;

export function getServer(): http.Server | null {
  return server;
}

export function isServerRunning(): boolean {
  return server !== null && server.listening;
}

/**
 * Write port file for MCP server discovery
 */
export function writePortFile(port: number): void {
  try {
    if (!fs.existsSync(PORT_FILE_DIR)) {
      fs.mkdirSync(PORT_FILE_DIR, { recursive: true });
    }
    const portFile = path.join(PORT_FILE_DIR, `${process.pid}.port`);
    fs.writeFileSync(portFile, JSON.stringify({ port, pid: process.pid, time: Date.now() }));
  } catch (e) {
    console.error("Failed to write port file:", e);
  }
}

/**
 * Cleanup port file
 */
export function cleanupPortFile(): void {
  try {
    const portFile = path.join(PORT_FILE_DIR, `${process.pid}.port`);
    if (fs.existsSync(portFile)) {
      fs.unlinkSync(portFile);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Start the HTTP server to receive requests from MCP
 */
export function startServer(
  port: number,
  onRequest: (request: AskRequest) => Promise<void>,
  onStatusChange: (running: boolean, port: number) => void,
  retryCount = 0
): void {
  if (server) {
    try {
      server.close();
    } catch {
      // Ignore close errors
    }
    server = null;
  }

  const newServer = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/ask") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const request = JSON.parse(body) as AskRequest;

          if (request.type === "io") {
            try {
              await onRequest(request);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: true }));
            } catch (dialogErr) {
              console.error("Error showing dialog:", dialogErr);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Failed to show dialog", details: String(dialogErr) }));
            }
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unknown request type" }));
          }
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  newServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      if (retryCount < 3) {
        const nextPort = port + 1;
        console.log(`Port ${port} in use, trying ${nextPort}...`);
        setTimeout(() => startServer(nextPort, onRequest, onStatusChange, retryCount + 1), 100);
      } else {
        onStatusChange(false, port);
      }
    } else {
      onStatusChange(false, port);
      console.error(`Server error: ${err.message}`);
    }
  });

  newServer.listen(port, "127.0.0.1", () => {
    server = newServer;
    console.log(`Session Helper server listening on port ${port}`);
    onStatusChange(true, port);
    writePortFile(port);
  });
}

/**
 * Stop the server
 */
export function stopServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
