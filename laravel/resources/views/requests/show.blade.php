@php($user = auth()->user())

<x-layout.app :title="$request->title">
    <main class="flex-1 py-6">
        <x-layout.container max="max-w-3xl">
            @unless ($request->status === 'visible')
                <p class="rounded-card bg-warning/10 text-warning mb-4 px-4 py-3 text-sm font-bold">
                    {{ $request->rejection_reason ?? __('community.awaiting_review') }}
                </p>
            @endunless

            <p class="text-dim text-xs font-bold">{{ __('community.intent_'.$request->intent) }}</p>
            <h1 class="mt-1 text-xl font-black">{{ $request->title }}</h1>
            <p class="text-dim mt-1 text-xs">{{ $request->placeLabel() }} · <x-user.link :name="$request->owner_name" :user="$request->owner" /></p>
            <p class="text-muted mt-3 leading-loose whitespace-pre-line">{{ $request->description }}</p>

            <section class="mt-8">
                <h2 class="text-base font-extrabold">{{ __('community.replies') }}</h2>

                @auth
                    <form method="POST" action="{{ \App\Support\Nav::href($request->path().'/repondre') }}" class="mt-3">
                        @csrf
                        <textarea name="text" rows="3" required minlength="2" maxlength="1000"
                            placeholder="{{ __('community.reply_placeholder') }}"
                            class="rounded-input border-border w-full border px-3 py-2.5 text-sm"></textarea>

                        @if (count($attachable) > 0)
                            {{-- Only the author's own published ads. Attaching
                                 someone else's would let anyone advertise an ad
                                 they do not control on a thread full of ready
                                 buyers — so the service checks it again. --}}
                            <select name="listing_id" class="rounded-input border-border mt-2 w-full border px-3 py-2.5 text-sm">
                                <option value="">{{ __('community.attach_listing') }}</option>
                                @foreach ($attachable as $option)
                                    <option value="{{ $option->id }}">{{ $option->title }}</option>
                                @endforeach
                            </select>
                        @endif

                        @error('text')<p class="text-danger mt-1 text-xs font-semibold">{{ $message }}</p>@enderror
                        <button class="bg-accent rounded-input mt-2 px-5 py-2.5 text-sm font-bold text-white">{{ __('community.send') }}</button>
                    </form>
                @endauth

                <ul class="mt-5 space-y-4">
                    @foreach ($request->replies as $reply)
                        @continue(! $reply->visibleTo($user))
                        <li class="border-border border-b pb-4 last:border-0">
                            <div class="flex items-center gap-2">
                                <p class="text-sm font-bold">
                                    <x-user.link :name="$reply->author_name" :user="$reply->author" />
                                </p>
                                @if ($reply->is_owner)
                                    <span class="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[11px] font-bold">
                                        {{ __('community.owner_badge') }}
                                    </span>
                                @endif
                            </div>
                            <p class="text-muted mt-1 text-sm leading-relaxed whitespace-pre-line">{{ $reply->text }}</p>

                            @if ($reply->listing)
                                <a href="{{ \App\Support\Nav::href($reply->listing->path()) }}"
                                    class="rounded-input border-border hover:border-primary mt-2 inline-block border px-3 py-2 text-xs font-bold transition-colors">
                                    {{ $reply->listing->title }}
                                </a>
                            @endif
                        </li>
                    @endforeach
                </ul>
            </section>
        </x-layout.container>
    </main>
</x-layout.app>
