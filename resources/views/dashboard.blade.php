<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Dashboard
        </h2>
    </x-slot>

    <div class="py-4 px-6">
        <h3 class="font-bold text-lg mb-4">週間習慣カレンダー</h3>

        {{-- 成功メッセージ --}}
        @if (session('success'))
            <div class="mb-4 text-green-600 font-semibold">
                ✔️ {{ session('success') }}
            </div>
        @endif

        {{-- カレンダー表 --}}
        <table class="w-full table-auto border-collapse bg-white rounded-lg shadow">
            <thead>
                <tr class="bg-gray-100 text-sm text-gray-600">
                    <th class="border px-4 py-2 text-left">習慣</th>
                    @foreach ($dates as $date)
                        <th class="border px-2 py-2 text-center">
                            {{ $date->format('n/j') }}<br>
                            <span class="text-xs text-gray-500">{{ $date->format('D') }}</span>
                        </th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @foreach ($habits as $habit)
                    <tr class="border-t">
                        <td class="border px-4 py-2 font-semibold text-gray-800">
                            {{ $habit->title }}
                        </td>
                        @foreach ($dates as $date)
                            @php
                                $key = $habit->id . '_' . $date->toDateString();
                                $log = $logs->get($key)?->first();
                            @endphp
                            <td class="border px-2 py-2 text-center {{ ($log && $log->status === 1) ? 'bg-green-100' : '' }}">
                                <form method="POST" action="{{ route('habit-logs.store') }}">
                                    @csrf
                                    <input type="hidden" name="habit_id" value="{{ $habit->id }}">
                                    <input type="hidden" name="date" value="{{ $date->toDateString() }}">
                                    <input
                                        type="checkbox"
                                        name="done"
                                        onchange="this.form.submit()"
                                        class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        @checked($log && $log->status === 1)
                                    >
                                </form>
                            </td>
                        @endforeach
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
</x-app-layout>