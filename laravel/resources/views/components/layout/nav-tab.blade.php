@props(['item', 'current' => null])

@php($active = $item['href'] === $current)

<li class="flex-1">
    <a
        href="{{ $item['href'] }}"
        @if ($active) aria-current="page" @endif
        class="flex min-h-14 flex-col items-center justify-center gap-1 py-2 transition-transform active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 {{ $active ? 'text-primary' : 'text-dim' }}"
    >
        <span class="grid place-items-center rounded-full px-4 py-1 transition-colors {{ $active ? 'bg-primary-soft' : 'bg-transparent' }}">
            <x-dynamic-component :component="'icon.'.$item['icon']" class="size-5" :stroke-width="$active ? '2.6' : '2'" />
        </span>
        <span class="text-[11px] font-bold">{{ $item['label'] }}</span>
    </a>
</li>
