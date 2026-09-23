<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\Amenity;
use App\Enums\Condition;
use App\Enums\HousingProgram;
use App\Enums\Paperwork;
use App\Enums\PriceUnit;
use App\Enums\RoomCode;
use App\Enums\SaleForm;
use App\Services\Geo;
use App\Services\ListingImageService;
use App\Services\Taxonomy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * What the publish form is allowed to say.
 *
 * Categories are checked against the *live* taxonomy rather than the enums,
 * because an admin can add one — and a form that offered a category the
 * validator then refused would be the site arguing with itself. Places are
 * checked against the seeded geography for the same reason the router checks
 * them: a commune only means anything inside its wilaya.
 */
final class StoreListingRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Whether this account may publish at all — quota, ban, approval — is
        // decided inside the transaction in ListingService, not here. A check
        // out here would be a second answer to the same question, and the one
        // that races.
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $taxonomy = Taxonomy::current();

        return [
            'title' => ['required', 'string', 'min:10', 'max:90'],
            'description' => ['required', 'string', 'min:20', 'max:5000'],

            'transaction_type' => ['required', Rule::in(array_keys($taxonomy->transactionTypes))],
            'property_type' => ['required', Rule::in(array_keys($taxonomy->propertyTypes))],
            'sale_form' => ['nullable', Rule::enum(SaleForm::class)],
            'housing_program' => ['nullable', Rule::enum(HousingProgram::class)],

            // Whole dinars. The ملايين convention is a display decision and
            // never reaches the server as a unit.
            'price' => ['nullable', 'integer', 'min:0', 'max:99999999999'],
            'price_unit' => ['nullable', Rule::enum(PriceUnit::class)],
            'price_on_request' => ['boolean'],
            'is_negotiable' => ['boolean'],

            'area_built' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'area_land' => ['nullable', 'integer', 'min:1', 'max:10000000'],
            'rooms_code' => ['nullable', Rule::enum(RoomCode::class)],
            'bathrooms' => ['nullable', 'integer', 'min:0', 'max:20'],
            'floor' => ['nullable', 'integer', 'min:-2', 'max:60'],
            'condition_code' => ['nullable', Rule::enum(Condition::class)],
            'paperwork' => ['nullable', Rule::enum(Paperwork::class)],

            'wilaya' => ['required', 'string', 'exists:wilayas,slug'],
            'commune' => ['required', 'string'],
            'quartier' => ['nullable', 'string', 'max:80'],

            'amenities' => ['nullable', 'array', 'max:20'],
            'amenities.*' => [Rule::enum(Amenity::class)],

            'photos' => ['nullable', 'array', 'max:'.config('taajir.max_images')],
            'photos.*' => [
                'file',
                'mimetypes:'.implode(',', ListingImageService::ACCEPTED),
                'max:'.(ListingImageService::MAX_BYTES / 1024),
            ],

            'contact_phone' => ['nullable', 'string', 'max:20'],
            'show_phone' => ['boolean'],
            'allow_whatsapp' => ['boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        // Unchecked boxes are absent from a form post rather than false, and
        // `boolean` on a missing key passes while leaving null in the input.
        $this->merge([
            'price_on_request' => $this->boolean('price_on_request'),
            'is_negotiable' => $this->boolean('is_negotiable'),
            'show_phone' => $this->boolean('show_phone'),
            'allow_whatsapp' => $this->boolean('allow_whatsapp'),
        ]);
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            // A commune only exists inside its wilaya; several wilayas share a
            // slug, so this cannot be a plain `exists` rule.
            $wilaya = Geo::wilaya((string) $this->input('wilaya'));

            if ($wilaya !== null && Geo::commune($wilaya->code, (string) $this->input('commune')) === null) {
                $validator->errors()->add('commune', __('validation.exists', ['attribute' => __('listing.commune_field')]));
            }

            // A price is required unless the seller explicitly asked not to
            // show one. Zero is "ask me", and storing it as a price would put
            // "0 دج" on the card.
            if (! $this->boolean('price_on_request') && (int) $this->input('price') <= 0) {
                $validator->errors()->add('price', __('validation.required', ['attribute' => __('listing.price_field')]));
            }
        });
    }
}
