<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The referral programme's points, and the only part of it this deployment
 * ships.
 *
 * §11 calls the affiliate programme roughly a third of the port's complexity
 * and legitimately optional for v1, and it is disabled by default upstream. So
 * the screens, the campaigns, the prizes and the payouts are not here — but the
 * ledger is, because §11 is equally clear about the one thing that must not
 * wait: migrate `points_ledger` anyway, so nobody's balance is lost.
 *
 * **The ledger is the truth; `users.points_balance` is a cache of it.** That is
 * the invariant the whole programme rests on and the reason the table comes
 * across first: a balance can drift, and the only way back from a drift is the
 * rows that produced it. `taajir:import` recomputes every balance from these
 * rows rather than trusting the number in the export.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('points_ledger', function (Blueprint $table) {
            $table->id();
            $table->string('uid', 28);
            // Positive grants, negative spends.
            $table->integer('delta');
            $table->string('reason', 32);
            // The invited account, for a referral or its clawback.
            $table->string('ref_uid', 28)->nullable();
            $table->string('campaign_id', 32)->nullable();
            $table->string('note')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['uid', 'created_at']);
            // Not a foreign key, and deliberately: the ledger is a financial
            // record, and it has to outlive a deleted account the same way the
            // audit trail outlives a deleted moderator.
            $table->index('ref_uid');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('points_ledger');
    }
};
