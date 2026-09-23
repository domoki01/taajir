<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\PriceUnit;
use App\Support\Price;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The 10 000x rule, pinned.
 *
 * Every expectation here is the output of the Next app's src/lib/price.ts for
 * the same input. If the two ever disagree, one of the two sites is quoting
 * property at ten thousand times the wrong price.
 */
final class PriceTest extends TestCase
{
    public function test_a_million_is_ten_thousand_dinars(): void
    {
        $this->assertSame(10_000, Price::toDinars(1, Price::INPUT_MILLION));
        $this->assertSame(8_000_000, Price::toDinars(800, Price::INPUT_MILLION));
    }

    public function test_dinars_pass_through_unconverted(): void
    {
        $this->assertSame(35_000, Price::toDinars(35_000, Price::INPUT_DZD));
    }

    public function test_input_is_rounded_to_whole_dinars(): void
    {
        $this->assertSame(8_500, Price::toDinars(0.85, Price::INPUT_MILLION));
        $this->assertSame(1_235, Price::toDinars(1234.6, Price::INPUT_DZD));
    }

    public function test_conversion_round_trips(): void
    {
        $this->assertSame(800.0, Price::fromDinars(8_000_000, Price::INPUT_MILLION));
        $this->assertSame(35_000.0, Price::fromDinars(35_000, Price::INPUT_DZD));
    }

    #[DataProvider('spokenPrices')]
    public function test_it_formats_the_way_a_seller_would_say_it(int $dinars, string $expected): void
    {
        $this->assertSame($expected, Price::format($dinars));
    }

    /** @return list<array{int, string}> */
    public static function spokenPrices(): array
    {
        return [
            // Sale prices are spoken in ملايين.
            [8_000_000, '800 مليون'],
            // Rents too, once past a million centimes — and one decimal only
            // when it carries information.
            [35_000, '3.5 مليون'],
            [30_000, '3 مليون'],
            // Below a مليون, plain dinars read better.
            [8_000, '8,000 دج'],
            // Past ten ملايين the decimal is noise.
            [12_340_000, '1,234 مليون'],
        ];
    }

    public function test_a_missing_or_zero_price_reads_as_negotiable(): void
    {
        $this->assertSame('السعر بالاتفاق', Price::format(0));
        $this->assertSame('السعر بالاتفاق', Price::format(null));
        $this->assertSame('السعر بالاتفاق', Price::format(-1));
        $this->assertSame('السعر بالاتفاق', Price::formatExact(0));
    }

    public function test_the_exact_form_keeps_every_dinar(): void
    {
        $this->assertSame('8,000,000 دج', Price::formatExact(8_000_000));
    }

    public function test_only_a_non_total_unit_earns_a_suffix(): void
    {
        $this->assertSame('800 مليون', Price::formatWithUnit(8_000_000, PriceUnit::Total));
        $this->assertSame('4.5 مليون في الشهر', Price::formatWithUnit(45_000, PriceUnit::Mois));
        $this->assertSame('1.2 مليون في الليلة', Price::formatWithUnit(12_000, PriceUnit::Nuit));
    }

    public function test_rent_scale_is_derived_from_the_unit(): void
    {
        $this->assertTrue(PriceUnit::Mois->isRental());
        $this->assertTrue(PriceUnit::Annee->isRental());
        $this->assertTrue(PriceUnit::Nuit->isRental());
        // A total or a per-m² price is a sale, so "a rental priced as a total"
        // cannot be expressed.
        $this->assertFalse(PriceUnit::Total->isRental());
        $this->assertFalse(PriceUnit::M2->isRental());
    }
}
