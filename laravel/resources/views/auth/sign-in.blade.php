{{-- The Firebase sign-in widget.

     Plain JavaScript against the Firebase SDK, not Livewire: the whole flow —
     the Google popup, the SMS, the reCAPTCHA — happens in the browser, and the
     only thing the server sees is the ID token posted to /auth/session once it
     is done. A server round trip in the middle would break the popup and buy
     nothing.

     Google is the only door that is drawn by default. The phone half is still
     here, behind TAAJIR_PHONE_SIGNIN, because thirty-five accounts in the
     Firestore export have a number and no email: the day they are imported
     that switch has to go on or every one of them is locked out, and
     `taajir:import` counts them and says so. TAAJIR_PHONE_SIGNUP is the
     narrower switch inside it — sign in, but no new numbers. --}}
@php
    // Same reason as the layout: a multi-line array inside a Blade directive is
    // a parse error, so the JSON is built before the script block.
    $firebaseConfig = json_encode([
        'apiKey' => config('firebase.api_key'),
        'authDomain' => config('firebase.auth_domain'),
        'projectId' => config('firebase.project_id'),
        'appId' => config('firebase.app_id'),
        'messagingSenderId' => config('firebase.messaging_sender_id'),
    ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
@endphp

<x-layout.app :title="$signUp ? __('auth.sign_up') : __('auth.sign_in')">
    <main class="flex flex-1 items-center py-10">
        <x-layout.container max="max-w-sm">
            <div class="rounded-card border-border bg-surface shadow-soft border p-6">
                <h1 class="text-xl font-black">{{ $signUp ? __('auth.sign_up') : __('auth.sign_in') }}</h1>
                <p class="text-dim mt-1 text-sm leading-relaxed">{{ __('auth.no_account_needed') }}</p>

                <div x-data="signIn(@js($next))" class="mt-6">
                    <p
                        x-show="error"
                        x-text="error"
                        x-cloak
                        role="alert"
                        class="rounded-input bg-danger/10 text-danger mb-4 px-3 py-2 text-sm font-semibold"
                    ></p>

                    <button
                        type="button"
                        x-on:click="withGoogle()"
                        x-bind:disabled="busy"
                        class="bg-accent rounded-input w-full py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >{{ __('auth.with_google') }}</button>

                    {{-- The phone door is drawn only when it is open. With it
                         shut this page is one button, which is the whole point:
                         the sign-up step that asked people to read a choice
                         they did not have was costing more than it explained. --}}
                    @if (! config('taajir.phone_signin_enabled'))
                        {{-- Nothing. Google is the only way in. --}}
                    @elseif ($signUp && ! config('taajir.phone_signup_enabled'))
                        <p class="text-muted mt-5 text-xs leading-relaxed">{{ __('auth.phone_signup_closed') }}</p>
                        <a href="{{ \App\Support\Nav::href('/connexion') }}" class="text-primary mt-2 inline-block text-sm font-bold">
                            {{ __('auth.sign_in') }}
                        </a>
                    @else
                        <div class="border-border mt-6 border-t pt-5">
                            {{-- Step one: the number. Step two: the code. One
                                 decision per screen, on a phone, with the button
                                 under the thumb. --}}
                            <div x-show="!codeSent">
                                <label for="phone" class="text-muted block text-xs font-bold">{{ __('auth.phone_label') }}</label>
                                <input
                                    id="phone"
                                    type="tel"
                                    inputmode="tel"
                                    autocomplete="tel"
                                    placeholder="+213 …"
                                    x-model="phone"
                                    dir="ltr"
                                    class="rounded-input border-border ltr-nums mt-1 w-full border px-3 py-2.5 text-sm"
                                >
                                <button
                                    type="button"
                                    x-on:click="sendCode()"
                                    x-bind:disabled="busy || !phone"
                                    class="rounded-input border-border text-primary mt-3 w-full border py-3 text-sm font-bold transition-colors hover:border-current disabled:opacity-60"
                                >{{ __('auth.send_code') }}</button>
                            </div>

                            <div x-show="codeSent" x-cloak>
                                <label for="code" class="text-muted block text-xs font-bold">{{ __('auth.code_label') }}</label>
                                <input
                                    id="code"
                                    type="text"
                                    inputmode="numeric"
                                    autocomplete="one-time-code"
                                    x-model="code"
                                    dir="ltr"
                                    class="rounded-input border-border ltr-nums mt-1 w-full border px-3 py-2.5 text-center text-lg tracking-widest"
                                >
                                <button
                                    type="button"
                                    x-on:click="confirmCode()"
                                    x-bind:disabled="busy || !code"
                                    class="bg-accent rounded-input mt-3 w-full py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                                >{{ __('auth.verify') }}</button>
                            </div>

                            {{-- reCAPTCHA renders itself into this. It must be
                                 in the document before signInWithPhoneNumber is
                                 called, which is why it is not inside either
                                 branch above. --}}
                            <div id="recaptcha" class="mt-3"></div>
                        </div>
                    @endif
                </div>
            </div>

            <p class="text-dim mt-4 text-center text-xs">
                @if ($signUp)
                    <a href="{{ \App\Support\Nav::href('/connexion') }}" class="text-primary font-bold">{{ __('auth.sign_in') }}</a>
                @else
                    <a href="{{ \App\Support\Nav::href('/inscription') }}" class="text-primary font-bold">{{ __('auth.sign_up') }}</a>
                @endif
            </p>
        </x-layout.container>
    </main>

    @push('scripts')
        <script type="module">
            import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
            import {
                getAuth, GoogleAuthProvider, signInWithPopup,
                RecaptchaVerifier, signInWithPhoneNumber,
            } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';

            const app = initializeApp({!! $firebaseConfig !!});

            const auth = getAuth(app);
            auth.useDeviceLanguage();

            window.taajirFirebase = {
                auth, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber,
            };
            window.dispatchEvent(new Event('taajir:firebase-ready'));
        </script>
    @endpush
</x-layout.app>
