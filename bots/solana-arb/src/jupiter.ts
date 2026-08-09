import { fetchWithRetry, Throttle } from "./http.js";

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label?: string;
      inputMint: string;
      outputMint: string;
    };
    percent: number;
  }>;
  [key: string]: unknown;
}

export interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  [key: string]: unknown;
}

export class JupiterClient {
  private readonly throttle: Throttle;
  private readonly headers: Record<string, string>;

  constructor(
    private readonly baseUrl: string,
    opts: { minIntervalMs: number; apiKey?: string | null },
  ) {
    this.throttle = new Throttle(opts.minIntervalMs);
    this.headers = opts.apiKey ? { "x-api-key": opts.apiKey } : {};
  }

  async quote(params: {
    inputMint: string;
    outputMint: string;
    amount: bigint;
    slippageBps: number;
  }): Promise<QuoteResponse> {
    const url = new URL(`${this.baseUrl}/quote`);
    url.searchParams.set("inputMint", params.inputMint);
    url.searchParams.set("outputMint", params.outputMint);
    url.searchParams.set("amount", params.amount.toString());
    url.searchParams.set("slippageBps", params.slippageBps.toString());
    url.searchParams.set("restrictIntermediateTokens", "true");

    const res = await fetchWithRetry(
      url,
      { headers: this.headers, signal: AbortSignal.timeout(10_000) },
      { throttle: this.throttle, label: "quote" },
    );
    return (await res.json()) as QuoteResponse;
  }

  async buildSwapTransaction(
    quoteResponse: QuoteResponse,
    userPublicKey: string,
  ): Promise<SwapResponse> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/swap`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
        signal: AbortSignal.timeout(10_000),
      },
      { throttle: this.throttle, label: "swap" },
    );
    return (await res.json()) as SwapResponse;
  }

  /** Labels of the DEXs a route touches, e.g. "Orca → Raydium". */
  static routeLabels(quote: QuoteResponse): string {
    const labels = quote.routePlan
      .map((step) => step.swapInfo.label ?? "?")
      .filter((label, i, all) => all.indexOf(label) === i);
    return labels.join(" → ");
  }
}
