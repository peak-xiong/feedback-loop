/**
 * Extension configuration constants
 */
import * as path from "path";
import * as os from "os";

export const MCP_CALLBACK_PORT = 23984;
export const PORT_FILE_DIR = path.join(os.tmpdir(), "uio-ports");
export const DEFAULT_PORT = 23983;
export const REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes
