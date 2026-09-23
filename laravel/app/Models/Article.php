<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\ArticleBody;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $slug
 * @property string $title
 * @property string $excerpt
 * @property list<array{type: string, text: string}> $body
 * @property string|null $cover_url
 * @property string $status
 * @property list<string> $tags
 * @property int $read_minutes
 * @property int $comment_count
 */
class Article extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'body' => 'array',
            'tags' => 'array',
            'published_at' => 'datetime',
        ];
    }

    public function comments(): HasMany
    {
        return $this->hasMany(ArticleComment::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    /** What a reader may see: published only. A draft is not a page. */
    public function scopePublic($query)
    {
        return $query->where('status', 'published');
    }

    /**
     * The blocks, each already split into runs of plain text.
     *
     * Done here rather than in the view so the view has no reason to hold a
     * string it might be tempted to print unescaped. What comes back is a list
     * of strings and a flag — never a string containing a tag.
     *
     * @return list<array{type: string, runs: list<array{text: string, bold: bool}>}>
     */
    public function blocks(): array
    {
        return array_map(fn (array $block) => [
            'type' => $block['type'] ?? 'p',
            'runs' => ArticleBody::runs((string) ($block['text'] ?? '')),
        ], $this->body ?? []);
    }

    public function path(): string
    {
        return '/articles/'.$this->slug;
    }
}
