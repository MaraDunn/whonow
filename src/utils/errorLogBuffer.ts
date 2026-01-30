/**
 * In-memory buffer of recent error log entries for bug reports.
 * Max 50 entries; each message truncated to 500 chars.
 */

const MAX_ENTRIES = 50;
const MAX_MESSAGE_LENGTH = 500;

interface LogEntry {
  message: string;
  timestamp: number;
}

const buffer: LogEntry[] = [];

function truncate(msg: string): string {
  if (typeof msg !== "string") return String(msg).slice(0, MAX_MESSAGE_LENGTH);
  return msg.slice(0, MAX_MESSAGE_LENGTH);
}

export function pushErrorLog(message: string): void {
  const trimmed = truncate(message);
  buffer.push({ message: trimmed, timestamp: Date.now() });
  if (buffer.length > MAX_ENTRIES) {
    buffer.shift();
  }
}

/**
 * Returns the last N entries formatted as a string (one line per entry).
 * Default N = 50 (all).
 */
export function getRecentErrorLogs(count: number = MAX_ENTRIES): string {
  const entries = buffer.slice(-count);
  if (entries.length === 0) return "(no recent errors)";
  return entries
    .map((e) => `${new Date(e.timestamp).toISOString()} ${e.message}`)
    .join("\n");
}
