@props(['name', 'user' => null])

{{-- A publisher's name, as a link to their page when there is one.

     Two things make this a component rather than an inline anchor. Names are
     rendered in seven places — comments, replies, demand cards, a demand page,
     the listing page, moderation — and they must all behave the same; and the
     account may be gone, because names are stored denormalised beside the row
     precisely so a comment keeps reading correctly after its author deletes
     their account. A missing account is a plain span, never a broken link.

     `primary`, not `accent`: this is information you follow, not a button you
     press. The ratio only holds while accent stays on buttons. --}}
@if ($user && ! $user->is_banned)
    <a href="{{ \App\Support\Nav::href($user->profileUrl()) }}"
       {{ $attributes->merge(['class' => 'text-primary hover:underline']) }}>{{ $name }}</a>
@else
    <span {{ $attributes }}>{{ $name }}</span>
@endif
