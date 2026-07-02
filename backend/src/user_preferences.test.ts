import assert from 'node:assert/strict';
import test from 'node:test';

import {
    resolveDailySyncEnabledPreference,
    type UserPreferenceRecord,
} from './user_preferences';

test('daily sync preference defaults to enabled when unset', () => {
    const preferences: UserPreferenceRecord[] = [];

    assert.equal(
        resolveDailySyncEnabledPreference(preferences),
        true,
    );
});

test('daily sync preference can explicitly disable the cron job', () => {
    const preferences: UserPreferenceRecord[] = [
        {
            preference_key: 'netease_daily_sync_enabled',
            preference_value: 'false',
            updated_at: '2026-07-02T00:00:00.000Z',
        },
    ];

    assert.equal(
        resolveDailySyncEnabledPreference(preferences),
        false,
    );
});
