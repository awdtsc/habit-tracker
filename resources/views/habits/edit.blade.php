{{-- resources/views/habits/edit.blade.php --}}
<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            習慣を編集
        </h2>
    </x-slot>

    <div class="min-h-screen bg-gray-100 py-12 px-4">
        <div class="max-w-xl mx-auto bg-white rounded shadow py-6 px-8">
            {{-- バリデーションエラー --}}
            @if ($errors->any())
                <div class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                    <ul class="list-disc pl-5">
                        @foreach ($errors->all() as $e)
                            <li>{{ $e }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <form method="POST" action="{{ route('habits.update', $habit->id) }}">
                @csrf
                @method('PUT')

                @php
                    $ft    = old('frequency_type', $habit->frequency_type ?? 'daily');
                    $dows  = old('days_of_week', is_array($habit->days_of_week ?? null) ? $habit->days_of_week : []);
                    $noEnd = old('no_end', is_null($habit->end_date));
                    $dowJp = [1=>'月',2=>'火',3=>'水',4=>'木',5=>'金',6=>'土',7=>'日'];

                    $tt = $habit->target_times;
                    if (is_string($tt)) { $tt = json_decode($tt, true) ?: []; }
                    $weeklyQuotaDefault = $tt['weekly'] ?? null;
                    $weeklyQuota = old('weekly_quota', $weeklyQuotaDefault ?? 3);

                    $evalType = old('evaluation_type', $habit->evaluation_type ?? 'simple');
                @endphp

                {{-- タイトル --}}
                <div class="mb-4">
                    <label class="block font-bold mb-1">タイトル</label>
                    <input type="text" name="title"
                           value="{{ old('title', $habit->title) }}"
                           class="w-full border rounded p-2">
                </div>

                {{-- 説明 --}}
                <div class="mb-4">
                    <label class="block font-bold mb-1">説明</label>
                    <textarea name="description" class="w-full border rounded p-2" rows="3">{{ old('description', $habit->description) }}</textarea>
                </div>

                {{-- 評価方式 --}}
                <div class="mb-4">
                    <label class="block font-bold mb-1">評価方式</label>
                    <select name="evaluation_type" class="w-full border rounded p-2">
                        <option value="simple" {{ $evalType==='simple' ? 'selected' : '' }}>単純評価（達成/未達成）</option>
                        <option value="self"   {{ $evalType==='self' ? 'selected' : '' }}>自己評価（点数やコメント付き）</option>
                    </select>
                </div>

                {{-- 頻度 --}}
                <div class="mb-4">
                    <label class="block font-bold mb-2">頻度</label>
                    <div class="grid grid-cols-2 gap-3">
                        @foreach ([
                            'daily'    => '毎日',
                            'weekdays' => '平日',
                            'weekends' => '週末',
                            'custom'   => 'カスタム（曜日指定）',
                            'quota'    => '週の回数（自由）',
                        ] as $val=>$label)
                            <label class="inline-flex items-center gap-2">
                                <input type="radio" name="frequency_type" value="{{ $val }}" {{ $ft === $val ? 'checked' : '' }}>
                                <span>{{ $label }}</span>
                            </label>
                        @endforeach
                    </div>

                    {{-- カスタム曜日 --}}
                    <div id="dowBox" class="mt-3 {{ $ft==='custom' ? '' : 'opacity-50 pointer-events-none' }}">
                        <div class="flex flex-wrap gap-3">
                            @foreach ($dowJp as $num=>$jp)
                                <label class="inline-flex items-center gap-2">
                                    <input type="checkbox" name="days_of_week[]"
                                           value="{{ $num }}"
                                           {{ in_array((int)$num, array_map('intval',$dows), true) ? 'checked' : '' }}>
                                    <span>{{ $jp }}</span>
                                </label>
                            @endforeach
                        </div>
                        <p class="mt-1 text-xs text-gray-500">※ カスタム選択時は曜日を指定</p>
                    </div>

                    {{-- 週クオータ --}}
                    <div id="quotaBox" class="mt-3 {{ $ft==='quota' ? '' : 'opacity-50 pointer-events-none' }}">
                        <label class="block font-bold mb-1">週の目標回数</label>
                        <input type="number" name="weekly_quota" min="1" max="7" step="1"
                               value="{{ $weeklyQuota }}"
                               class="w-28 border rounded p-2">
                        <p class="mt-1 text-xs text-gray-500">例: 3 → 「今週3回できれば達成」</p>
                    </div>
                </div>

                {{-- 期間 --}}
                <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label class="block font-bold mb-1">開始日</label>
                        <input type="date" name="start_date"
                               value="{{ old('start_date', optional($habit->start_date)->toDateString()) }}"
                               class="w-full border rounded p-2">
                    </div>
                    <div>
                        <label class="block font-bold mb-1">終了日</label>
                        <div class="flex items-center gap-3">
                            <input type="date" id="end_date" name="end_date"
                                   value="{{ old('end_date', optional($habit->end_date)->toDateString()) }}"
                                   class="border rounded p-2">
                            <label class="inline-flex items-center gap-2 text-sm">
                                <input type="checkbox" id="no_end" name="no_end" value="1" {{ $noEnd ? 'checked' : '' }}>
                                <span>終了日なし（ずっと）</span>
                            </label>
                        </div>
                    </div>
                </div>

                {{-- 任意メタ --}}
                <div class="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {{-- 評価方式 --}}
                    <div class="mb-4">
                        <label class="block font-bold mb-1">評価方式</label>
                        @php $evalType = old('evaluation_type', 'simple'); @endphp
                        <select name="evaluation_type" class="w-full border rounded p-2" required>
                            <option value="simple" {{ $evalType==='simple' ? 'selected' : '' }}>
                                単純評価（達成/未達成）
                            </option>
                            <option value="self" {{ $evalType==='self' ? 'selected' : '' }}>
                                自己評価（点数やコメント付き）
                            </option>
                        </select>
                        <p class="mt-1 text-xs text-gray-500">
                            ※ 自己評価を選ぶと <code>habit_logs.rating</code> を使って1〜5点などで自己採点できます
                        </p>
                    </div>
                    <div>
                        <label class="block font-bold mb-1">時間帯（任意）</label>
                        @php $slot = old('time_slot', $habit->time_slot ?? 'anytime'); @endphp
                        <select name="time_slot" class="w-full border rounded p-2">
                            @foreach (['anytime'=>'いつでも','morning'=>'朝','noon'=>'昼','evening'=>'夕','night'=>'夜'] as $v=>$l)
                                <option value="{{ $v }}" {{ $slot===$v?'selected':'' }}>{{ $l }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold mb-1">カテゴリ（任意）</label>
                        <input type="text" name="category" value="{{ old('category', $habit->category) }}" class="w-full border rounded p-2">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block font-bold mb-1">カラー（任意 / 例: #22c55e）</label>
                        <input type="text" name="color_tag" value="{{ old('color_tag', $habit->color_tag) }}" class="w-full border rounded p-2">
                    </div>
                </div>

                <div class="mt-6 flex justify-end gap-3">
                    <a href="{{ route('habits.index') }}" class="px-4 py-2 rounded border">戻る</a>
                    <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">更新</button>
                </div>
            </form>

            {{-- 削除 --}}
            <form method="POST" action="{{ route('habits.destroy', $habit->id) }}" class="mt-4 text-right" onsubmit="return confirm('本当に削除しますか？')">
                @csrf
                @method('DELETE')
                <button type="submit" class="text-red-600 hover:underline">削除</button>
            </form>
        </div>
    </div>

    {{-- インタラクション --}}
    <script>
        (function () {
            const ftRadios = document.querySelectorAll('input[name="frequency_type"]');
            const dowBox   = document.getElementById('dowBox');
            const quotaBox = document.getElementById('quotaBox');
            const endDate  = document.getElementById('end_date');
            const noEnd    = document.getElementById('no_end');

            function toggle(el, on) {
                if (!el) return;
                el.classList.toggle('opacity-50', !on);
                el.classList.toggle('pointer-events-none', !on);
            }
            function refresh() {
                const v = [...ftRadios].find(r => r.checked)?.value;
                toggle(dowBox,   v === 'custom');
                toggle(quotaBox, v === 'quota');
            }
            function syncEnd() {
                if (!endDate || !noEnd) return;
                endDate.disabled = noEnd.checked;
                if (noEnd.checked) endDate.value = '';
            }
            ftRadios.forEach(r => r.addEventListener('change', refresh));
            noEnd && noEnd.addEventListener('change', syncEnd);

            refresh();
            syncEnd();
        })();
    </script>
</x-app-layout>