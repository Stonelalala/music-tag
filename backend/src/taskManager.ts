import { db } from './db';
import crypto from 'crypto';

export type TaskType = 'scan' | 'scrape' | 'download_netease' | 'download_qq' | 'download_kugou' | 'download_kuwo' | 'organize' | 'rename' | 'playlist_import' | 'netease_daily_sync';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
    id: string;
    parent_id?: string;
    type: TaskType;
    status: TaskStatus;
    priority: number;
    progress: number;
    message: string;
    payload?: string;
    result?: string;
    logs: string;
    created_at: string;
    updated_at: string;
}

class TaskManager {
    // In-memory set of cancelled task IDs to allow long-running logic to check status
    private cancelledTasks = new Set<string>();

    createTask(type: TaskType, message: string, payload?: any, parentId?: string, priority = 0): string {
        const id = crypto.randomUUID();
        const payloadStr = payload ? JSON.stringify(payload) : null;

        db.prepare(`
            INSERT INTO tasks (id, type, status, priority, progress, message, payload, logs, parent_id)
            VALUES (?, ?, 'pending', ?, 0, ?, ?, '', ?)
        `).run(id, type, priority, message, payloadStr, parentId || null);

        return id;
    }

    updateTask(id: string, updates: Partial<Pick<Task, 'status' | 'priority' | 'progress' | 'message' | 'result'>>) {
        const sets: string[] = [];
        const params: any[] = [];

        if (updates.status) {
            sets.push('status = ?');
            params.push(updates.status);
        }
        if (updates.priority !== undefined) {
            sets.push('priority = ?');
            params.push(updates.priority);
        }
        if (updates.progress !== undefined) {
            sets.push('progress = ?');
            params.push(updates.progress);
        }
        if (updates.message) {
            sets.push('message = ?');
            params.push(updates.message);
        }
        if (updates.result) {
            sets.push('result = ?');
            params.push(updates.result);
        }

        if (sets.length === 0) return;

        sets.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    }

    cancelTask(id: string) {
        this.cancelledTasks.add(id);

        // Mark the main task and all its children as cancelled in DB
        db.prepare("UPDATE tasks SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? OR parent_id = ?").run(id, id);

        // Also add children to memory set
        const children = db.prepare('SELECT id FROM tasks WHERE parent_id = ?').all(id) as { id: string }[];
        children.forEach(c => this.cancelledTasks.add(c.id));
    }

    isCancelled(id: string): boolean {
        // First check memory (fast)
        if (this.cancelledTasks.has(id)) return true;

        // If not in memory but marked in DB, add back to memory and return
        const task = db.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as { status: string } | undefined;
        if (task?.status === 'cancelled') {
            this.cancelledTasks.add(id);
            return true;
        }
        return false;
    }

    addLog(id: string, log: string) {
        console.log(`[Task:${id}] ${log}`);
        db.prepare(`
            UPDATE tasks 
            SET logs = logs || ? || '\n', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(log, id);
    }

    getTask(id: string): Task | undefined {
        return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    }

    getRecentTasks(limit = 50): Task[] {
        return db.prepare(`
            SELECT *
            FROM tasks
            ORDER BY
                CASE
                    WHEN status IN ('running', 'pending') THEN 0
                    ELSE 1
                END ASC,
                priority DESC,
                created_at DESC
            LIMIT ?
        `).all(limit) as Task[];
    }

    setPriority(id: string, priority: number) {
        const normalized = Math.max(-5, Math.min(5, Math.trunc(priority)));
        db.prepare(`
            UPDATE tasks
            SET priority = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(normalized, id);
    }

    cleanupOldTasks(days = 7) {
        // First clean up children, then parents
        db.prepare("DELETE FROM tasks WHERE parent_id IS NOT NULL AND created_at < datetime('now', ?)")
            .run(`-${days} days`);
        db.prepare("DELETE FROM tasks WHERE parent_id IS NULL AND created_at < datetime('now', ?)")
            .run(`-${days} days`);

        this.cancelledTasks.clear(); // Safe to clear memory set on cleanup
    }
}

export const taskManager = new TaskManager();
