function stamp(): string {
  return new Date().toISOString();
}

const debugEnabled = (process.env.DEBUG ?? "").toLowerCase() === "true";

export const log = {
  debug(msg: string): void {
    if (debugEnabled) console.log(`${stamp()} [debug] ${msg}`);
  },
  info(msg: string): void {
    console.log(`${stamp()} [info] ${msg}`);
  },
  warn(msg: string): void {
    console.warn(`${stamp()} [warn] ${msg}`);
  },
  error(msg: string, err?: unknown): void {
    const detail = err instanceof Error ? ` — ${err.message}` : "";
    console.error(`${stamp()} [error] ${msg}${detail}`);
  },
  opportunity(msg: string): void {
    console.log(`${stamp()} [ARB] ${msg}`);
  },
};
