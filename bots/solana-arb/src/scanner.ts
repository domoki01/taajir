import type { BotConfig } from "./config.js";
import { USDC_MINT } from "./config.js";
import { JupiterClient, type QuoteResponse } from "./jupiter.js";

export interface RoundTrip {
  tokenMint: string;
  legOut: QuoteResponse;
  legBack: QuoteResponse;
  startAmount: bigint;
  endAmount: bigint;
  /** Round-trip edge in basis points; negative means the trip loses money. */
  profitBps: number;
}

/**
 * Quotes the round trip USDC -> token -> USDC. The two legs can route through
 * different pools when DEX prices diverge; a positive round-trip delta is the
 * arbitrage edge, before network fees and leg risk.
 */
export async function quoteRoundTrip(
  jupiter: JupiterClient,
  config: BotConfig,
  tokenMint: string,
): Promise<RoundTrip> {
  const legOut = await jupiter.quote({
    inputMint: USDC_MINT,
    outputMint: tokenMint,
    amount: config.tradeSizeUsdc,
    slippageBps: config.slippageBps,
  });

  const legBack = await jupiter.quote({
    inputMint: tokenMint,
    outputMint: USDC_MINT,
    amount: BigInt(legOut.outAmount),
    slippageBps: config.slippageBps,
  });

  const startAmount = config.tradeSizeUsdc;
  const endAmount = BigInt(legBack.outAmount);
  // Scale before dividing: bigint division truncates.
  const profitBps = Number(((endAmount - startAmount) * 10_000n) / startAmount);

  return { tokenMint, legOut, legBack, startAmount, endAmount, profitBps };
}

export function isActionable(trip: RoundTrip, config: BotConfig): boolean {
  return trip.profitBps >= config.minProfitBps;
}
