<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'dark') == 'dark']) @if ($appearanceOverride ?? false) data-appearance-override="{{ $appearance }}" @endif>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "dark" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }

                // Saved colour theme (resources/js/hooks/use-color-theme.tsx), added
                // before paint so Vercel / Notion never flash the Fiori colours.
                try {
                    const theme = localStorage.getItem('color-theme');

                    if (theme === 'vercel' || theme === 'notion') {
                        document.documentElement.classList.add('theme-' + theme);
                    }
                } catch (e) {
                    // Storage blocked: the default theme is used.
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: #ffffff;
            }

            html.dark {
                background-color: #12171c;
            }

            html.theme-vercel {
                background-color: #fafafa;
            }

            html.theme-vercel.dark {
                background-color: #0a0a0a;
            }

            html.theme-notion {
                background-color: #f6f5f4;
            }

            html.theme-notion.dark {
                background-color: #191919;
            }
        </style>

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
