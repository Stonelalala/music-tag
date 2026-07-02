import { db } from './db';

export const NETEASE_DAILY_SYNC_ENABLED_PREFERENCE_KEY =
    'netease_daily_sync_enabled';

export interface UserPreferenceRecord {
    preference_key: string;
    preference_value: string | null;
    updated_at: string;
}

export const getPrimaryUserId = () => {
    const user = db.prepare(
        'SELECT id FROM users ORDER BY created_at ASC LIMIT 1',
    ).get() as { id: string } | undefined;
    return user?.id ?? null;
};

export const getUserPreferences = (userId: string) =>
    db.prepare(`
        SELECT preference_key, preference_value, updated_at
        FROM user_preferences
        WHERE user_id = ?
        ORDER BY updated_at DESC
    `).all(userId) as UserPreferenceRecord[];

export const resolveDailySyncEnabledPreference = (
    preferences: UserPreferenceRecord[],
) => {
    const match = preferences.find(
        (item) =>
            item.preference_key === NETEASE_DAILY_SYNC_ENABLED_PREFERENCE_KEY,
    );
    if (!match || match.preference_value == null) {
        return true;
    }

    try {
        return JSON.parse(match.preference_value) !== false;
    } catch (_) {
        return match.preference_value !== 'false';
    }
};

export const isNeteaseDailySyncEnabled = () => {
    const userId = getPrimaryUserId();
    if (!userId) {
        return true;
    }
    return resolveDailySyncEnabledPreference(getUserPreferences(userId));
};
