import "dotenv/config";

export interface BotConfig {
  rpcUrl: string;
  jupiterBaseUrl: string;
  jupiterApiKey: string | null;
  /** Minimum gap between Jupiter requests; the free tier rate-limits hard. */
  requestIntervalMs: number;
  privateKey: string | null;
  dryRun: boolean;
  /** Trade size in USDC base units (6 decimals). */
  tradeSizeUsdc: bigint;
  /** Minimum round-trip profit, in basis points, before a trade fires. */
  minProfitBps: number;
  slippageBps: number;
  scanIntervalMs: number;
  /** Mints scanned against USDC. */
  tokenMints: string[];
}

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const DEFAULT_TOKENS = [
  // SOL (wrapped)
  "So11111111111111111111111111111111111111112",
  // JUP
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  // JTO
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
];

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid value for ${name}: "${raw}"`);
  }
  return value;
}

export function loadConfig(): BotConfig {
  const dryRun = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
  const privateKey = process.env.PRIVATE_KEY?.trim() || null;
  if (!dryRun && !privateKey) {
    throw new Error("DRY_RUN=false requires PRIVATE_KEY to be set");
  }

  const usdcAmount = envNumber("TRADE_SIZE_USDC", 10);
  const tokens = (process.env.TOKENS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    rpcUrl: process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com",
    jupiterBaseUrl:
      process.env.JUPITER_BASE_URL ?? "https://lite-api.jup.ag/swap/v1",
    jupiterApiKey: process.env.JUPITER_API_KEY?.trim() || null,
    requestIntervalMs: envNumber("REQUEST_INTERVAL_MS", 1200),
    privateKey,
    dryRun,
    tradeSizeUsdc: BigInt(Math.round(usdcAmount * 1_000_000)),
    minProfitBps: envNumber("MIN_PROFIT_BPS", 30),
    slippageBps: envNumber("SLIPPAGE_BPS", 50),
    scanIntervalMs: envNumber("SCAN_INTERVAL_MS", 3000),
    tokenMints: tokens.length > 0 ? tokens : DEFAULT_TOKENS,
  };
}
