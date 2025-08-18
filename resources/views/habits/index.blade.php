{{-- resources/views/habits/index.blade.php --}}
<x-app-layout>
    <x-slot name="header">
        <h2 class="text-xl font-semibold text-gray-800">習慣一覧</h2>
    </x-slot>

    <div class="max-w-4xl mx-auto p-4">
        {{-- フラッシュメッセージ --}}
        @if (session('success'))
            <div class="mb-4 text-green-600">
                {{ session('success') }}
            </div>
        @endif

        {{-- 習慣が存在しない場合 --}}
        @if ($habits->isEmpty())
            <p class="text-gray-600">まだ習慣が登録されていません。</p>
        @else
            <div class="space-y-4">
                @foreach ($habits as $habit)
                    <div class="mb-4 p-4 bg-white rounded-lg shadow">
                        <h4 class="font-bold text-xl mb-2">{{ $habit->title }}</h4>
                        <p class="mb-1">{{ $habit->description }}</p>
                        <p class="text-sm text-gray-600">頻度: {{ $habit->frequency_type }}</p>
                        <p class="text-sm text-gray-600">開始日: {{ $habit->start_date }}</p>
                        <p class="text-sm text-gray-600">終了日: {{ $habit->end_date }}</p>

                        <div class="mt-2 flex space-x-2">
                            {{-- 編集ボタン --}}
                            <a href="{{ route('habits.edit', $habit->id) }}" class="text-blue-500">編集</a>

                            {{-- 削除ボタン --}}
                            <form method="POST" action="{{ route('habits.destroy', $habit->id) }}">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="text-red-500" onclick="return confirm('本当に削除しますか？')">削除</button>
                            </form>
                        </div>
                    </div>
                @endforeach
            </div>
        @endif

        {{-- 新しい習慣を追加するボタン --}}

        <div class="mt-6 text-right">
            <a href="{{ route('habits.create') }}" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                ＋ 新しく習慣を追加
            </a>
        </div>
    </div>
</x-app-layout>