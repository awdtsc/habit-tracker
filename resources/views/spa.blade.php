<!-- resources/views/spa.blade.php -->
<!doctype html>
<html lang="{{ str_replace('_','-', app()->getLocale()) }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Habit Tracker</title>

  {{-- ViteでCSSとJSを読み込む --}}
  @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="antialiased">
  <div id="app"></div>
</body>
</html>