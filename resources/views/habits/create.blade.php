<x-app-layout>
    <x-slot name="header">
        <h2 class="text-xl font-semibold leading-tight text-gray-800">
            習慣を追加
        </h2>
    </x-slot>

    <div class="max-w-2xl mx-auto p-4">
        {{-- エラーメッセージ表示 --}}
        @if ($errors->any())
            <div class="mb-4 text-red-600">
                <ul>
                    @foreach ($errors->all() as $error)
                        <li>• {{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        {{-- 登録フォーム --}}
        <form method="POST" action="{{ route('habits.store') }}">
            @csrf

            <div class="mb-4">
                <label class="block mb-1 font-semibold" for="title">タイトル</label>
                <input type="text" name="title" id="title" class="w-full border p-2" required>
            </div>

            <div class="mb-4">
                <label class="block mb-1 font-semibold" for="description">説明</label>
                <textarea name="description" id="description" class="w-full border p-2"></textarea>
            </div>

            <div class="mb-4">
                <label class="block mb-1 font-semibold" for="frequency_type">頻度</label>

                <select name="frequency_type" id="frequency_type" class="w-full border p-2">
                    <option value="daily">毎日</option>
                    <option value="weekly">毎週</option>
                    <option value="custom">カスタム</option>
                </select>

                {{-- weekly用：週に何回 --}}
                <div class="mt-2" id="weekly_count_section" style="display: none;">
                    <label class="block mb-1 font-semibold" for="weekly_count">週に何回実施？</label>
                    <input type="number" name="weekly_count" id="weekly_count" min="1" max="7" class="w-full border p-2" placeholder="例：3">
                </div>

                {{-- custom用：曜日選択 --}}
                <div class="mt-2" id="days_of_week_section" style="display: none;">
                    <label class="block mb-1 font-semibold">曜日を選択</label>
                    <div class="flex flex-wrap gap-2">
                        <label><input type="checkbox" name="days_of_week[]" value="0"> 日</label>
                        <label><input type="checkbox" name="days_of_week[]" value="1"> 月</label>
                        <label><input type="checkbox" name="days_of_week[]" value="2"> 火</label>
                        <label><input type="checkbox" name="days_of_week[]" value="3"> 水</label>
                        <label><input type="checkbox" name="days_of_week[]" value="4"> 木</label>
                        <label><input type="checkbox" name="days_of_week[]" value="5"> 金</label>
                        <label><input type="checkbox" name="days_of_week[]" value="6"> 土</label>
                    </div>
                </div>
            </div>

            {{-- 開始日と終了日の入力 --}}
            <div class="mb-4">
                <label class="block mb-1 font-semibold" for="start_date">開始日</label>
                <input type="date" name="start_date" id="start_date" class="w-full border p-2">
            </div>

            <div class="mb-4">
                <label class="block mb-1 font-semibold" for="end_date">終了日</label>
                <input type="date" name="end_date" id="end_date" class="w-full border p-2">
            </div>

            <div class="text-right">
                <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded">登録</button>
            </div>
        </form>
        <script>
            document.getElementById('frequency_type').addEventListener('change', function () {
                const freq = this.value;
                document.getElementById('weekly_count_section').style.display = (freq === 'weekly') ? 'block' : 'none';
                document.getElementById('days_of_week_section').style.display = (freq === 'custom') ? 'block' : 'none';
            });
        </script>
    </div>
</x-app-layout>