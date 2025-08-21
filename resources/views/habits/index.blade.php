<x-app-layout>
  <x-slot name="header">
    <h2 class="text-xl font-semibold text-slate-800">習慣一覧</h2>
  </x-slot>

  <main class="mx-auto max-w-[960px] px-4 sm:px-6 py-6 space-y-8">
    {{-- ダッシュボード（今日タブなどのVueが載る） --}}
    <div id="habit-dashboard-root" class="space-y-6"></div>

    {{-- 一覧カード（Vueで置き換え）。必要URLを data-* で渡す --}}
    <div
      id="habits-index-root"
      data-habits-base="{{ url('/habits') }}"
      data-create-url="{{ route('habits.create') }}"
    ></div>

    {{-- JS 無効時のフォールバックCTA（Vueが描画したら隠れる想定） --}}
    <noscript>
      <div class="text-right">
        <a href="{{ route('habits.create') }}"
           class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white shadow-md">
          <span class="text-lg">＋</span> 新しく習慣を追加
        </a>
      </div>
    </noscript>
  </main>

  @vite(['resources/css/app.css','resources/js/habits-dashboard.js','resources/js/habits-index.js'])
</x-app-layout>