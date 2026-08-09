import { loadConfig } from "./config.js";
import { Executor } from "./executor.js";
import { RateLimitError } from "./http.js";
import { JupiterClient } from "./jupiter.js";
import { log } from "./logger.js";
import { isActionable, quoteRoundTrip, type RoundTrip } from "./scanner.js";

function summarise(trips: RoundTrip[]): string {
  return trips
    .sort((a, b) => b.profitBps - a.profitBps)
    .map(
      (t) =>
        `${t.tokenMint.slice(0, 4)}…${t.profitBps >= 0 ? "+" : ""}${t.profitBps}bps`,
    )
    .join("  ");
}

async function main(): Promise<void> {
  const config = loadConfig();
  const jupiter = new JupiterClient(config.jupiterBaseUrl, {
    minIntervalMs: config.requestIntervalMs,
    apiKey: config.jupiterApiKey,
  });
  const executor = config.dryRun ? null : new Executor(jupiter, config);

  log.info(
    `mode=${config.dryRun ? "DRY RUN (no trades)" : `LIVE wallet=${executor!.publicKey}`}`,
  );
  log.info(
    `size=${Number(config.tradeSizeUsdc) / 1e6} USDC, minProfit=${config.minProfitBps} bps, ` +
      `slippage=${config.slippageBps} bps, tokens=${config.tokenMints.length}, ` +
      `interval=${config.scanIntervalMs}ms, requestGap=${config.requestIntervalMs}ms`,
  );

  let running = true;
  let cycles = 0;
  let hits = 0;
  let rateLimited = 0;
  process.on("SIGINT", () => {
    running = false;
    log.info(`shutting down — ${cycles} cycles, ${hits} opportunities seen`);
  });

  while (running) {
    const trips: RoundTrip[] = [];

    for (const mint of config.tokenMints) {
      if (!running) break;
      try {
        const trip = await quoteRoundTrip(jupiter, config, mint);
        rateLimited = 0;
        trips.push(trip);

        if (!isActionable(trip, config)) continue;
        hits += 1;
        const pnl = Number(trip.endAmount - trip.startAmount) / 1e6;
        log.opportunity(
          `${mint}: +${trip.profitBps} bps (≈ ${pnl.toFixed(4)} USDC) ` +
            `out[${JupiterClient.routeLabels(trip.legOut)}] ` +
            `back[${JupiterClient.routeLabels(trip.legBack)}]`,
        );
        if (executor) {
          await executor.execute(trip);
        }
      } catch (err) {
        if (err instanceof RateLimitError) {
          rateLimited += 1;
          // Only the first one is worth reading; the rest are the same story.
          if (rateLimited === 1) {
            log.warn(
              "Jupiter is rate-limiting us. Raise REQUEST_INTERVAL_MS, or set " +
                "JUPITER_API_KEY and point JUPITER_BASE_URL at api.jup.ag.",
            );
          }
          continue;
        }
        log.error(`round trip failed for ${mint}`, err);
      }
    }

    cycles += 1;
    // Near misses are the useful signal in dry run: they show how far the
    // market actually sits from the threshold.
    if (trips.length > 0) {
      log.info(`cycle ${cycles}: ${summarise(trips)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, config.scanIntervalMs));
  }
}

main().catch((err) => {
  log.error("fatal", err);
  process.exit(1);
});
