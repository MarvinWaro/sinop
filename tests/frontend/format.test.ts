import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDayDateTime } from '../../resources/js/lib/format.ts';

void test('toast times read as the day, date and time in Philippine time', () => {
    // 08:41 UTC is 4:41 PM in Manila.
    assert.equal(
        formatDayDateTime('2026-10-31T08:41:00Z'),
        'Saturday, Oct 31, 2026 · 04:41 PM',
    );
    // Past midnight in Manila it is already the next day.
    assert.equal(
        formatDayDateTime('2026-10-31T17:05:00Z'),
        'Sunday, Nov 01, 2026 · 01:05 AM',
    );
    assert.equal(formatDayDateTime(null), '—');
});
