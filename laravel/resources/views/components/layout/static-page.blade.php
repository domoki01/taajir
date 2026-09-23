{{-- Shared shell for the legal and help pages, which are all prose. --}}
@props(['title' => null, 'description' => null])

<x-layout.app :title="$title" :description="$description">
    <x-layout.header />

    <main class="flex-1 py-10">
        <x-layout.container max="max-w-3xl">
            <div class="[&_h1]:mb-6 [&_h1]:text-2xl [&_h1]:font-black md:[&_h1]:text-3xl [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_li]:leading-loose [&_p]:leading-loose [&_p]:text-[color:var(--color-muted)] [&_ul]:list-disc [&_ul]:ps-5">
                {{ $slot }}
            </div>
        </x-layout.container>
    </main>
</x-layout.app>
