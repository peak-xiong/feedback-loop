/**
 * MCP client for communicating with MCP server
 */
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { PORT_FILE_DIR } from "../core/config";

/**
 * Send response back to MCP server
 */
export async function sendResponseToMCP(
  requestId: string,
  userInput: string,
  cancelled: boolean,
  callbackPort: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      requestId,
      userInput,
      cancelled,
    });

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: callbackPort,
        path: "/response",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 5000,
      },
      (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          resolve();
        } else {
          reject(new Error(`MCP server returned status ${res.statusCode}`));
        }
      }
    );

    req.on("error", (e) => {
      reject(new Error(`Failed to send response: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Cleanup old MCP callback port processes
 */
export async function cleanupOldMcpProcesses(): Promise<void> {
  const isWindows = process.platform === "win32";
  
  for (let port = 23984; port <= 24034; port++) {
    try {
      if (isWindows) {
        exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
          if (!err && stdout) {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && /^\d+$/.test(pid) && pid !== process.pid.toString()) {
                exec(`taskkill /F /PID ${pid}`, () => {
                  console.log(`Killed old process on port ${port}`);
                });
              }
            }
          }
        });
      } else {
        exec(`lsof -ti:${port}`, (err, stdout) => {
          if (!err && stdout) {
            const pids = stdout.trim().split('\n');
            for (const pid of pids) {
              if (pid && pid !== process.pid.toString()) {
                exec(`kill -9 ${pid}`, () => {
                  console.log(`Killed old process on port ${port}`);
                });
              }
            }
          }
        });
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  
  try {
    if (fs.existsSync(PORT_FILE_DIR)) {
      const files = fs.readdirSync(PORT_FILE_DIR);
      for (const file of files) {
        if (file.endsWith('.port')) {
          const filePath = path.join(PORT_FILE_DIR, file);
          try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (content.pid && content.pid !== process.pid) {
              if (isWindows) {
                exec(`tasklist /FI "PID eq ${content.pid}"`, (err, stdout) => {
                  if (!stdout || !stdout.includes(content.pid.toString())) {
                    fs.unlinkSync(filePath);
                  }
                });
              } else {
                exec(`ps -p ${content.pid}`, (err) => {
                  if (err) fs.unlinkSync(filePath);
                });
              }
            }
          } catch {
            fs.unlinkSync(filePath);
          }
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
