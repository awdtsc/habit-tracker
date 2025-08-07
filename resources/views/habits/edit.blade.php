{{-- resources/views/habits/edit.blade.php --}}
<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            習慣を編集
        </h2>
    </x-slot>

    <div class="min-h-screen bg-gray-100 py-12 px-4">
        <div class="max-w-xl mx-auto bg-white rounded shadow py-6 px-8">
            <form method="POST" action="{{ route('habits.update', $habit->id) }}">
                @csrf
                @method('PUT')

                <div class="mb-4">
                    <label class="block font-bold">タイトル</label>
                    <input type="text" name="title" value="{{ old('title', $habit->title) }}" class="w-full border rounded p-2">
                </div>

                <div class="mb-4">
                    <label class="block font-bold">説明</label>
                    <textarea name="description" class="w-full border rounded p-2">{{ old('description', $habit->description) }}</textarea>
                </div>

                <div class="mb-4">
                    <label class="block font-bold">頻度</label>
                    <input type="text" name="frequency_type" value="{{ old('frequency_type', $habit->frequency_type) }}" class="w-full border rounded p-2">
                </div>

                <div class="mb-4">
                    <label class="block font-bold">開始日</label>
                    <input type="date" name="start_date" value="{{ old('start_date', $habit->start_date) }}" class="w-full border rounded p-2">
                </div>

                <div class="mb-4">
                    <label class="block font-bold">終了日</label>
                    <input type="date" name="end_date" value="{{ old('end_date', $habit->end_date) }}" class="w-full border rounded p-2">
                </div>

                <div class="flex justify-end">
                    <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded">更新</button>
                </div>
            </form>

            <form method="POST" action="{{ route('habits.destroy', $habit->id) }}" class="mt-4 text-right">
                @csrf
                @method('DELETE')
                <button type="submit" class="text-red-500" onclick="return confirm('本当に削除しますか？')">削除</button>
            </form>
        </div>
    </div>
</x-app-layout>