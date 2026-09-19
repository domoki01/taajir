{{-- The hamburger. Rendered by whichever bar is on screen; both open the one
     panel the layout renders. --}}
<button
    type="button"
    x-data
    x-on:click="$store.menu.show()"
    aria-label="{{ __('nav.menu') }}"
    aria-haspopup="dialog"
    {{ $attributes->merge(['class' => 'text-primary hover:bg-surface-soft grid size-10 place-items-center rounded-full transition-colors']) }}
>
    <x-icon.menu class="size-6" stroke-width="2.3" />
</button>
