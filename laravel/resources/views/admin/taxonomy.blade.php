{{-- ── CATEGORIES AND FILTER ────────────────────────────────────────────────
     Order, visibility and wording for both lists, plus the categories an admin
     added that the code has never heard of.

     Hiding stops at the dropdown. A hidden slug keeps resolving, an ad filed
     under it keeps its page and it still appears under "every type" — a toggle
     that could make paid listings disappear would be a far worse problem than
     one extra line in a menu. --}}
@php
    $lists = [
        ['key' => 'deals', 'rows' => $deals, 'title' => __('admin.taxonomy.deals'), 'note' => __('admin.taxonomy.deals_note')],
        ['key' => 'properties', 'rows' => $properties, 'title' => __('admin.taxonomy.properties'), 'note' => __('admin.taxonomy.properties_note')],
    ];
@endphp

<x-admin.page :root="false" :title="__('admin.nav.taxonomy')" :subtitle="__('admin.taxonomy.subtitle')">

    <form method="POST" action="{{ \App\Support\Nav::href('/admin/filtre') }}" class="mt-4 space-y-4">
        @csrf

        @foreach ($lists as $list)
            <section class="rounded-card border-border bg-surface shadow-soft border p-4">
                <h2 class="text-sm font-black">{{ $list['title'] }}</h2>
                <p class="text-muted mt-1 text-xs leading-relaxed">{{ $list['note'] }}</p>

                <ul class="mt-3 space-y-2">
                    @foreach ($list['rows'] as $index => $row)
                        <li class="border-border flex flex-wrap items-center gap-2 border-t pt-2 first:border-t-0 first:pt-0">
                            {{-- The order is the order of the inputs. There is
                                 no drag handle: reordering by number survives
                                 without JavaScript, and this screen is opened
                                 once a quarter. --}}
                            <input type="hidden" name="{{ $list['key'] }}[{{ $index }}][slug]" value="{{ $row['slug'] }}">

                            <span dir="ltr" class="text-dim w-28 shrink-0 text-start text-[11px] font-bold">{{ $row['slug'] }}</span>

                            <input name="{{ $list['key'] }}[{{ $index }}][label]" required minlength="2" maxlength="40"
                                value="{{ $row['label'] }}"
                                aria-label="{{ __('admin.taxonomy.label_for', ['slug' => $row['slug']]) }}"
                                class="rounded-input border-border min-w-0 flex-1 border px-3 py-2 text-xs">

                            {{-- Visibility posts as a list of slugs rather than
                                 a checkbox per row: an unticked box sends
                                 nothing, so a row would come back with no key
                                 and no way to tell "shown" from "dropped". --}}
                            <label class="flex shrink-0 items-center gap-1.5 text-[11px] font-bold">
                                <input type="checkbox" name="hidden[{{ $list['key'] }}][]" value="{{ $row['slug'] }}"
                                    @checked($row['hidden']) class="accent-primary size-4">
                                {{ __('admin.taxonomy.hide') }}
                            </label>

                            @if ($row['custom'])
                                <span class="bg-primary/5 text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                                    {{ __('admin.taxonomy.custom') }}
                                </span>
                            @endif
                        </li>
                    @endforeach
                </ul>
            </section>
        @endforeach

        <button class="bg-accent rounded-input w-full px-5 py-3 text-sm font-bold text-white">
            {{ __('admin.taxonomy.save') }}
        </button>
    </form>

    {{-- Deleting is outside the save form, and refuses while anything is filed
         under the slug. A listing whose type no longer resolves has no label,
         drops out of the filter and keeps a URL that now 404s. --}}
    @foreach ([['deal', $deals], ['type', $properties]] as [$kind, $rows])
        @foreach ($rows as $row)
            @continue(! $row['custom'])
            <form method="POST" action="{{ \App\Support\Nav::href('/admin/filtre/'.$kind.'/'.$row['slug']) }}" class="mt-2">
                @csrf
                @method('DELETE')
                <button class="text-danger rounded-input border-danger/40 border px-4 py-2 text-xs font-bold">
                    {{ __('admin.taxonomy.delete', ['label' => $row['label']]) }}
                </button>
            </form>
        @endforeach
    @endforeach

    <section class="rounded-card border-border bg-surface shadow-soft mt-6 border p-4">
        <h2 class="text-sm font-black">{{ __('admin.taxonomy.new_property') }}</h2>
        {{-- The slug is permanent from this moment: it goes into
             /vente/{slug}/alger and into every listing filed under it. --}}
        <p class="text-muted mt-1 text-xs leading-relaxed">{{ __('admin.taxonomy.slug_is_forever') }}</p>

        <form method="POST" action="{{ \App\Support\Nav::href('/admin/filtre/categorie') }}" class="mt-3 flex flex-wrap items-center gap-2">
            @csrf
            <input name="slug" dir="ltr" required placeholder="hangar" aria-label="{{ __('admin.taxonomy.slug') }}"
                class="rounded-input border-border w-36 border px-3 py-2 text-start text-xs">
            <input name="label" required minlength="2" maxlength="40" placeholder="{{ __('admin.taxonomy.label') }}"
                aria-label="{{ __('admin.taxonomy.label') }}"
                class="rounded-input border-border min-w-0 flex-1 border px-3 py-2 text-xs">
            <button class="bg-accent rounded-input px-4 py-2 text-xs font-bold text-white">{{ __('admin.taxonomy.add') }}</button>
        </form>
    </section>

    <section class="rounded-card border-border bg-surface shadow-soft mt-3 border p-4">
        <h2 class="text-sm font-black">{{ __('admin.taxonomy.new_deal') }}</h2>
        {{-- A deal is the only category the code reasons about numerically: the
             unit beside the price, and the scale the price is read on. Declared
             once here, read from the taxonomy everywhere else. --}}
        <p class="text-muted mt-1 text-xs leading-relaxed">{{ __('admin.taxonomy.deal_unit_note') }}</p>

        <form method="POST" action="{{ \App\Support\Nav::href('/admin/filtre/operation') }}" class="mt-3 space-y-2">
            @csrf
            <div class="flex flex-wrap items-center gap-2">
                <input name="slug" dir="ltr" required placeholder="cession" aria-label="{{ __('admin.taxonomy.slug') }}"
                    class="rounded-input border-border w-36 border px-3 py-2 text-start text-xs">
                <input name="label" required minlength="2" maxlength="40" placeholder="{{ __('admin.taxonomy.post_label') }}"
                    aria-label="{{ __('admin.taxonomy.post_label') }}"
                    class="rounded-input border-border min-w-0 flex-1 border px-3 py-2 text-xs">
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <input name="filter_label" maxlength="40" placeholder="{{ __('admin.taxonomy.search_label') }}"
                    aria-label="{{ __('admin.taxonomy.search_label') }}"
                    class="rounded-input border-border min-w-0 flex-1 border px-3 py-2 text-xs">
                <select name="price_unit" aria-label="{{ __('admin.taxonomy.price_unit') }}"
                    class="rounded-input border-border bg-surface border px-3 py-2 text-xs font-semibold">
                    @foreach ($units as $unit)
                        <option value="{{ $unit->value }}">{{ $unit->label() }}</option>
                    @endforeach
                </select>
                <button class="bg-accent rounded-input px-4 py-2 text-xs font-bold text-white">{{ __('admin.taxonomy.add') }}</button>
            </div>
        </form>
    </section>

    <form method="POST" action="{{ \App\Support\Nav::href('/admin/filtre/defaut') }}" class="mt-3">
        @csrf
        @method('DELETE')
        <button class="text-muted rounded-input border-border w-full border px-5 py-3 text-xs font-bold">
            {{ __('admin.taxonomy.reset') }}
        </button>
    </form>
</x-admin.page>
