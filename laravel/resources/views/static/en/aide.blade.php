@php
    $faq = [
        [
            'q' => 'How do I search for a property?',
            'a' => 'You can search by wilaya, commune, property type (sale or rent), price and number of rooms. Every wilaya has its own page, and you can share its link with anyone.',
        ],
        [
            'q' => 'What does it cost to post an ad?',
            'a' => 'Posting is free for individuals. Estate agencies have paid plans that give them a larger ad quota and promotion for their listings.',
        ],
        [
            'q' => 'Why are prices quoted in millions?',
            'a' => 'Because that is how the Algerian market talks. One million is 10,000 DZD, so a flat advertised at 800 million costs 8,000,000 DZD. Prices on English pages are shown in dinars to avoid the confusion.',
        ],
        [
            'q' => 'I found a fake ad — what should I do?',
            'a' => 'Report it so we can review it and take it down. Before that, read the safety tips page — most scams start with a request for a deposit before any viewing.',
        ],
        [
            'q' => 'What do "notarised deed" and "land register book" mean?',
            'a' => "They describe the property's paperwork, and they are the first thing a buyer asks about. A property with a notarised deed or a land register book is easier to sell and to finance than one held under a private agreement or still being regularised.",
        ],
    ];
@endphp

<x-layout.static-page
    title="Help"
    description="Common questions about posting ads, searching for a property and subscriptions on {{ __('brand.name') }}."
>
    <article>
        <h1>Help</h1>

        @foreach ($faq as $item)
            <section>
                <h2>{{ $item['q'] }}</h2>
                <p>{{ $item['a'] }}</p>
            </section>
        @endforeach

        <h2>Didn't find your answer?</h2>
        <p>
            Read the <a href="{{ \App\Support\Nav::href('/securite') }}">safety tips</a>
            and the <a href="{{ \App\Support\Nav::href('/cgu') }}">terms of use</a>.
        </p>
    </article>
</x-layout.static-page>
