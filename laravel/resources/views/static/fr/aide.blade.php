@php
    $faq = [
        [
            'q' => 'Comment chercher un bien ?',
            'a' => "Vous pouvez chercher par wilaya, commune, type de bien (vente ou location), prix et nombre de pièces. Chaque wilaya a sa propre page, dont vous pouvez partager le lien avec n'importe qui.",
        ],
        [
            'q' => 'Combien coûte la publication d\'une annonce ?',
            'a' => "La publication est gratuite pour les particuliers. Les agences immobilières disposent de forfaits payants qui leur donnent un quota d'annonces plus élevé et une mise en avant de leurs annonces.",
        ],
        [
            'q' => 'Pourquoi les prix sont-ils affichés en millions ?',
            'a' => "Parce que c'est ainsi que parle le marché en Algérie. Un million vaut 10 000 DA : un appartement à 800 millions coûte donc 8 000 000 DA.",
        ],
        [
            'q' => "J'ai trouvé une fausse annonce, que faire ?",
            'a' => "Signalez-la pour que nous puissions l'examiner et la supprimer. Et avant cela, lisez la page des conseils de sécurité — la plupart des arnaques commencent par une demande d'avance avant la visite.",
        ],
        [
            'q' => 'Que signifient « acte notarié » et « livret foncier » ?',
            'a' => "C'est l'état des documents du bien, et c'est la première chose qu'un acheteur demande. Un bien avec acte notarié ou livret foncier se vend et se finance plus facilement qu'un bien sous acte sous seing privé ou en cours de régularisation.",
        ],
    ];
@endphp

<x-layout.static-page
    title="Aide"
    description="Questions fréquentes sur la publication d'annonces, la recherche d'un bien et les abonnements sur {{ __('brand.name') }}."
>
    <article>
        <h1>Aide</h1>

        @foreach ($faq as $item)
            <section>
                <h2>{{ $item['q'] }}</h2>
                <p>{{ $item['a'] }}</p>
            </section>
        @endforeach

        <h2>Vous n'avez pas trouvé votre réponse ?</h2>
        <p>
            Lisez les <a href="{{ \App\Support\Nav::href('/securite') }}">conseils de sécurité</a>
            et les <a href="{{ \App\Support\Nav::href('/cgu') }}">conditions d'utilisation</a>.
        </p>
    </article>
</x-layout.static-page>
