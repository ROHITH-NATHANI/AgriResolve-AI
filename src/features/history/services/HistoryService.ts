import { get, set, del, keys, getMany } from 'idb-keyval';
import { CropAnalysisRecord } from '../types';

const STORE_KEY_PREFIX = 'agri_resolve_record_';

export class HistoryService {
    /**
     * Saves a new analysis record.
     * We use a specific prefix to distinguish these records from other 
     * potential data stored in the same IDB database.
     */
    static async saveRecord(record: CropAnalysisRecord): Promise<void> {
        try {
            const key = `${STORE_KEY_PREFIX}${record.id}`;
            await set(key, record);
            console.log(`[HistoryService] Saved record ${key}`);
        } catch (error) {
            console.error('Failed to persist analysis record:', error);
            throw new Error('Storage failure during save operation.');
        }
    }

    /**
     * Retrieves all records for the history sidebar.
     */
    static async getAllRecords(): Promise<CropAnalysisRecord[]> {
        try {
            const allKeys = await keys();
            const recordKeys = allKeys.filter(k =>
                typeof k === 'string' && k.startsWith(STORE_KEY_PREFIX)
            );

            if (recordKeys.length === 0) return [];

            const records = await getMany(recordKeys);
            // Sort by timestamp descending (newest first)
            return records.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.error('Failed to fetch history:', error);
            return [];
        }
    }

    static async getRecordById(id: string): Promise<CropAnalysisRecord | undefined> {
        return await get(`${STORE_KEY_PREFIX}${id}`);
    }

    static async deleteRecord(id: string): Promise<void> {
        await del(`${STORE_KEY_PREFIX}${id}`);
    }

    static async clearHistory(): Promise<void> {
        const allKeys = await keys();
        const recordKeys = allKeys.filter(k =>
            typeof k === 'string' && k.startsWith(STORE_KEY_PREFIX)
        );
        await Promise.all(recordKeys.map(k => del(k)));
    }
}
