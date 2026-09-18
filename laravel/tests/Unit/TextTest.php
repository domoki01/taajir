<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\Text;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class TextTest extends TestCase
{
    #[DataProvider('pairsThatMustMatch')]
    public function test_spellings_of_the_same_word_fold_together(string $a, string $b): void
    {
        $this->assertSame(Text::normalize($a), Text::normalize($b));
    }

    /** @return list<array{string, string}> */
    public static function pairsThatMustMatch(): array
    {
        return [
            // The one this function exists for.
            'hamza on yaa' => ['الجزائر', 'الجزاير'],
            'hamza on alef' => ['أدرار', 'ادرار'],
            'hamza below' => ['إليزي', 'اليزي'],
            'madda' => ['آفلو', 'افلو'],
            'hamza on waw' => ['المؤسسة', 'الموسسة'],
            'taa marbuta' => ['بجاية', 'بجايه'],
            'alef maqsura' => ['مصطفى', 'مصطفي'],
            'harakat' => ['الجَزائِر', 'الجزائر'],
            'tatweel' => ['الجــزائر', 'الجزائر'],
            'french accents' => ['Béjaïa', 'Bejaia'],
            'case' => ['ORAN', 'oran'],
            'apostrophes' => ["M'sila", 'Msila'],
            'curly apostrophe' => ['M’sila', 'Msila'],
            'surrounding space' => ['  alger  ', 'alger'],
        ];
    }

    public function test_it_does_not_fold_words_that_are_actually_different(): void
    {
        $this->assertNotSame(Text::normalize('alger'), Text::normalize('oran'));
        $this->assertNotSame(Text::normalize('سطيف'), Text::normalize('سكيكدة'));
    }

    public function test_it_leaves_plain_text_alone(): void
    {
        $this->assertSame('bab-ezzouar', Text::normalize('bab-ezzouar'));
        $this->assertSame('f3', Text::normalize('F3'));
    }
}
