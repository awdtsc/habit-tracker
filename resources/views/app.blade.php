<!-- resources/views/app.blade.php -->
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <title>Habit Tracker</title>
  @vite(['resources/css/app.css','resources/js/app.js'])
</head>
<body class="antialiased">
  <div id="app"></div>
</body>
</html>