<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Article;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Article> */
class ArticleFactory extends Factory
{
    protected $model = Article::class;

    public function definition(): array
    {
        return [
            'slug' => fake()->unique()->slug(4),
            'title' => 'كيفاش تكري دار في الجزائر بلا سمسار',
            'excerpt' => 'شرح مبسّط على الكراء في الجزائر: الأوراق، الضمان، والأخطاء اللي يديروها الناس.',
            'body' => [
                ['type' => 'p', 'text' => 'الفقرة الأولى.'],
                ['type' => 'h2', 'text' => 'الأوراق'],
                ['type' => 'p', 'text' => 'الفقرة الثانية.'],
            ],
            'author_uid' => 'seeded-author-uid',
            'author_name' => 'التحرير',
            'status' => 'published',
            'tags' => ['كراء'],
            'read_minutes' => 1,
            'published_at' => now(),
            'comment_count' => 0,
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => 'draft', 'published_at' => null]);
    }
}
