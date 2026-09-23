@props(['title', 'links', 'path'])

<div class="mb-1">
    <h2 class="text-dim px-3 pt-3 pb-1 text-[11px] font-extrabold tracking-wide">{{ $title }}</h2>
    <ul>
        @foreach ($links as $link)
            @php
                $current = $link['href'] === '/'
                    ? $path === '/'
                    : ($path === $link['href'] || str_starts_with($path, $link['href'].'/'));
            @endphp
            <li>
                <a
                    href="{{ \App\Support\Nav::href($link['href']) }}"
                    x-bind:tabindex="$store.menu.open ? 0 : -1"
                    @if ($current) aria-current="page" @endif
                    class="block rounded-[10px] px-3 py-2.5 text-[15px] transition-colors {{ $current ? 'bg-primary-soft text-primary font-extrabold' : 'text-muted hover:bg-surface-soft font-semibold' }}"
                >{{ $link['label'] }}</a>
            </li>
        @endforeach
    </ul>
</div>
