import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import type { BotConfig } from "./config.js";
import { USDC_MINT } from "./config.js";
import { JupiterClient } from "./jupiter.js";
import { log } from "./logger.js";
import type { RoundTrip } from "./scanner.js";

export class Executor {
  private readonly connection: Connection;
  private readonly keypair: Keypair;

  constructor(
    private readonly jupiter: JupiterClient,
    private readonly config: BotConfig,
  ) {
    if (!config.privateKey) {
      throw new Error("Executor requires PRIVATE_KEY");
    }
    this.connection = new Connection(config.rpcUrl, "confirmed");
    this.keypair = Keypair.fromSecretKey(bs58.decode(config.privateKey));
  }

  get publicKey(): string {
    return this.keypair.publicKey.toBase58();
  }

  /**
   * Executes the two legs sequentially. This is NOT atomic: leg 2 is
   * re-quoted after leg 1 confirms, so the edge can be gone by then and the
   * round trip can close at a loss up to the slippage tolerance. Atomic
   * arbitrage needs both swaps in one transaction (custom program or Jito
   * bundle), which is beyond this educational bot.
   */
  async execute(opp: RoundTrip): Promise<void> {
    log.info(`executing leg 1: USDC -> ${opp.tokenMint}`);
    const sig1 = await this.signAndSend(opp.legOut);
    log.info(`leg 1 confirmed: ${sig1}`);

    // Re-quote leg 2 with the amount leg 1 was quoted to deliver; the actual
    // fill may differ within slippage, in which case the swap uses what the
    // wallet actually holds via the quoted route.
    const freshBack = await this.jupiter.quote({
      inputMint: opp.tokenMint,
      outputMint: USDC_MINT,
      amount: BigInt(opp.legOut.outAmount),
      slippageBps: this.config.slippageBps,
    });
    log.info(`executing leg 2: ${opp.tokenMint} -> USDC`);
    const sig2 = await this.signAndSend(freshBack);
    log.info(`leg 2 confirmed: ${sig2}`);

    const end = BigInt(freshBack.outAmount);
    const pnl = Number(end - opp.startAmount) / 1_000_000;
    log.info(`round trip closed, quoted PnL ≈ ${pnl.toFixed(4)} USDC`);
  }

  private async signAndSend(
    quote: Parameters<JupiterClient["buildSwapTransaction"]>[0],
  ): Promise<string> {
    const swap = await this.jupiter.buildSwapTransaction(quote, this.publicKey);
    const tx = VersionedTransaction.deserialize(
      Buffer.from(swap.swapTransaction, "base64"),
    );
    tx.sign([this.keypair]);

    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });
    const latest = await this.connection.getLatestBlockhash("confirmed");
    const result = await this.connection.confirmTransaction(
      { signature, ...latest },
      "confirmed",
    );
    if (result.value.err) {
      throw new Error(
        `transaction failed: ${JSON.stringify(result.value.err)}`,
      );
    }
    return signature;
  }
}
