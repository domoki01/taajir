<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\PriceUnit;
use App\Services\Taxonomy;
use Tests\TestCase;

final class TaxonomyTest extends TestCase
{
    public function test_with_no_settings_it_is_the_built_ins(): void
    {
        $taxonomy = new Taxonomy;

        $this->assertSame('شقة', $taxonomy->propertyTypes['appartement']);
        $this->assertSame('بيع', $taxonomy->transactionTypes['vente']);
        $this->assertSame('للبيع / شراء', $taxonomy->transactionFilterLabels['vente']);
        $this->assertSame(PriceUnit::Mois, $taxonomy->transactionUnits['location']);
    }

    public function test_an_admin_may_rename_a_category_but_not_move_it(): void
    {
        $taxonomy = new Taxonomy(['propertyLabels' => ['appartement' => 'شقة سكنية']]);

        // The label changes; the slug, which is in every URL, does not.
        $this->assertSame('شقة سكنية', $taxonomy->propertyTypes['appartement']);
        $this->assertArrayHasKey('appartement', $taxonomy->propertyTypes);
    }

    public function test_a_blank_rename_is_ignored(): void
    {
        $taxonomy = new Taxonomy(['propertyLabels' => ['appartement' => '   ']]);

        $this->assertSame('شقة', $taxonomy->propertyTypes['appartement']);
    }

    public function test_a_rename_of_something_that_no_longer_exists_does_not_resurrect_it(): void
    {
        $taxonomy = new Taxonomy(['propertyLabels' => ['chateau' => 'قصر']]);

        $this->assertArrayNotHasKey('chateau', $taxonomy->propertyTypes);
    }

    public function test_an_admin_may_add_a_category(): void
    {
        $taxonomy = new Taxonomy([
            'customPropertyTypes' => [['slug' => 'chalet', 'label' => 'شاليه']],
        ]);

        $this->assertSame('شاليه', $taxonomy->propertyTypes['chalet']);
        $this->assertSame(['chalet'], $taxonomy->customPropertySlugs);
    }

    public function test_a_built_in_wins_a_collision(): void
    {
        // A custom row shadowing `appartement` would silently rename a category
        // that thousands of listings already point at.
        $taxonomy = new Taxonomy([
            'customPropertyTypes' => [['slug' => 'appartement', 'label' => 'شيء آخر']],
        ]);

        $this->assertSame('شقة', $taxonomy->propertyTypes['appartement']);
        $this->assertSame([], $taxonomy->customPropertySlugs);
    }

    public function test_a_slug_that_could_not_live_in_a_url_is_refused(): void
    {
        $taxonomy = new Taxonomy([
            'customPropertyTypes' => [
                ['slug' => 'Chalet', 'label' => 'شاليه'],   // uppercase
                ['slug' => '-chalet', 'label' => 'شاليه'],  // leading dash
                ['slug' => 'chalet-', 'label' => 'شاليه'],  // trailing dash
                ['slug' => 'ch', 'label' => 'شاليه'],       // too short
                ['slug' => 'شاليه', 'label' => 'شاليه'],     // not Latin
            ],
        ]);

        $this->assertSame([], $taxonomy->customPropertySlugs);
    }

    public function test_a_custom_deal_declares_its_own_price_unit(): void
    {
        // This declaration is what lets the rest of the site handle a deal it
        // has never heard of.
        $taxonomy = new Taxonomy([
            'customTransactionTypes' => [
                ['slug' => 'colocation', 'label' => 'سكن مشترك', 'priceUnit' => 'mois'],
            ],
        ]);

        $this->assertSame(PriceUnit::Mois, $taxonomy->transactionUnits['colocation']);
        $this->assertTrue($taxonomy->transactionUnits['colocation']->isRental());
    }

    public function test_a_price_unit_the_code_does_not_know_falls_back_to_a_total(): void
    {
        // A unit with no scale behind it would file the price on neither the
        // rent nor the sale scale.
        $taxonomy = new Taxonomy([
            'customTransactionTypes' => [
                ['slug' => 'colocation', 'label' => 'سكن مشترك', 'priceUnit' => 'par-semaine'],
            ],
        ]);

        $this->assertSame(PriceUnit::Total, $taxonomy->transactionUnits['colocation']);
    }

    public function test_a_custom_deal_falls_back_to_its_own_label_when_searching(): void
    {
        $taxonomy = new Taxonomy([
            'customTransactionTypes' => [['slug' => 'colocation', 'label' => 'سكن مشترك']],
        ]);

        $this->assertSame('سكن مشترك', $taxonomy->transactionFilterLabels['colocation']);
    }

    public function test_hidden_options_leave_the_dropdown_but_not_the_taxonomy(): void
    {
        $taxonomy = new Taxonomy;
        $settings = ['hiddenPropertyTypes' => ['hangar']];

        $visible = array_column($taxonomy->visibleOptions($settings)['propertyTypes'], 'slug');

        $this->assertNotContains('hangar', $visible);
        // …but the slug stays valid everywhere else, so /vente/hangar/alger
        // keeps resolving and a published hangar keeps its page.
        $this->assertArrayHasKey('hangar', $taxonomy->propertyTypes);
    }

    public function test_the_admin_order_comes_first_and_the_rest_keeps_code_order(): void
    {
        $taxonomy = new Taxonomy;
        $settings = ['propertyTypeOrder' => ['villa', 'terrain']];

        $slugs = array_column($taxonomy->visibleOptions($settings)['propertyTypes'], 'slug');

        $this->assertSame(['villa', 'terrain'], array_slice($slugs, 0, 2));
        // Everything unmentioned keeps the order the code declares it in.
        $this->assertSame('appartement', $slugs[2]);
    }

    public function test_an_order_naming_something_that_no_longer_exists_drops_it(): void
    {
        $taxonomy = new Taxonomy;
        $settings = ['propertyTypeOrder' => ['chateau', 'villa']];

        $slugs = array_column($taxonomy->visibleOptions($settings)['propertyTypes'], 'slug');

        $this->assertNotContains('chateau', $slugs);
        $this->assertSame('villa', $slugs[0]);
    }

    public function test_an_unknown_slug_prints_as_itself_rather_than_blank(): void
    {
        $taxonomy = new Taxonomy;

        $this->assertSame('chateau', Taxonomy::labelOf($taxonomy->propertyTypes, 'chateau'));
    }
}
