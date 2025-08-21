<!-- resources/views/spa.blade.php -->
<!doctype html>
<html lang="{{ str_replace('_','-', app()->getLocale()) }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard</title>
  @vite(['resources/css/app.css', 'resources/js/spa.js'])
</head>
<body class="antialiased">
  <div id="app"></div>
</body>
</html>