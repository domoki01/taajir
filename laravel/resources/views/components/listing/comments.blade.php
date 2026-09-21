{{-- The thread under an ad.

     Hidden comments stay in the list for their author and for a moderator, with
     a marker instead of the text — deleting would lose the evidence of what was
     said, which is exactly what somebody needs when the argument starts. --}}
@props(['listing'])

@php($user = auth()->user())

<section class="mt-8">
    <h2 class="text-base font-extrabold">{{ __('community.comments') }}</h2>

    @auth
        <form method="POST" action="{{ \App\Support\Nav::href('/annonce/'.$listing->id.'/commentaires') }}" class="mt-3">
            @csrf
            <textarea name="text" rows="3" required minlength="2" maxlength="1000"
                placeholder="{{ __('community.comment_placeholder') }}"
                class="rounded-input border-border w-full border px-3 py-2.5 text-sm">{{ old('text') }}</textarea>
            @error('text')<p class="text-danger mt-1 text-xs font-semibold">{{ $message }}</p>@enderror
            <button class="bg-accent rounded-input mt-2 px-5 py-2.5 text-sm font-bold text-white">{{ __('community.send') }}</button>
        </form>
    @else
        <a href="{{ \App\Support\Nav::href('/connexion') }}" class="text-primary mt-3 inline-block text-sm font-bold">
            {{ __('auth.sign_in') }}
        </a>
    @endauth

    <ul class="mt-5 space-y-4">
        @forelse ($listing->comments as $comment)
            @continue(! $comment->visibleTo($user))
            <li class="border-border border-b pb-4 last:border-0">
                <div class="flex items-center gap-2">
                    <p class="text-sm font-bold">
                        <x-user.link :name="$comment->author_name" :user="$comment->author" />
                    </p>
                    @if ($comment->is_owner)
                        {{-- So a reader can tell the seller from everyone else
                             without cross-referencing names. --}}
                        <span class="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-[11px] font-bold">
                            {{ __('community.owner_badge') }}
                        </span>
                    @endif
                </div>

                @if ($comment->status === 'hidden')
                    <p class="text-dim mt-1 text-sm italic">{{ __('community.hidden') }}</p>
                @endif
                <p class="text-muted mt-1 text-sm leading-relaxed whitespace-pre-line">{{ $comment->text }}</p>

                @if ($user && ($user->uid === $comment->author_uid || $user->hasPermission(\App\Enums\Permission::CommentsModerate)))
                    <form method="POST" action="{{ \App\Support\Nav::href('/commentaires/'.$comment->id) }}" class="mt-1">
                        @csrf @method('DELETE')
                        <button class="text-danger text-xs font-bold">{{ __('community.delete') }}</button>
                    </form>
                @endif
            </li>
        @empty
            <li class="text-dim text-sm">{{ __('community.no_comments') }}</li>
        @endforelse
    </ul>
</section>
