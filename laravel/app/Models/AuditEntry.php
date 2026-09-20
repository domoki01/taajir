<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Lang;

/**
 * @property string $actor_uid
 * @property string $action
 */
class AuditEntry extends Model
{
    protected $table = 'admin_audit';

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['detail' => 'array', 'created_at' => 'datetime'];
    }

    /** @param array<string, mixed> $detail */
    public static function record(User $actor, string $action, string $targetType, string $targetId, array $detail = []): self
    {
        return static::create([
            'actor_uid' => $actor->uid,
            // Denormalised, for the same reason the listing carries its owner's
            // name: the log is read long after, and a join to an account that
            // may since have been deleted is not one worth depending on.
            'actor_name' => $actor->display_name,
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'detail' => $detail === [] ? null : $detail,
            'created_at' => now(),
        ]);
    }

    /**
     * What this row says, in words.
     *
     * A missing translation falls back to the stored action string rather than
     * printing a lang key. The log outlives the release that wrote it: an
     * action name that has since left the code still has to render as
     * *something* a human can read and search for.
     */
    public function actionLabel(): string
    {
        return $this->translate('admin.audit.actions.'.$this->action, $this->action);
    }

    public function targetLabel(): string
    {
        return $this->translate('admin.audit.targets.'.$this->target_type, $this->target_type);
    }

    /** The one free-text detail worth showing in a list: why. */
    public function note(): ?string
    {
        $note = $this->detail['reason'] ?? $this->detail['note'] ?? null;

        return is_string($note) && $note !== '' ? $note : null;
    }

    private function translate(string $key, string $fallback): string
    {
        return Lang::has($key) ? (string) __($key) : $fallback;
    }
}
