import { useState, useEffect, useCallback } from 'react';
import { HistoryService } from '../services/HistoryService';
import { CropAnalysisRecord } from '../types';

export function usePersistentHistory() {
    const [history, setHistory] = useState<CropAnalysisRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const records = await HistoryService.getAllRecords();
            setHistory(records);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Failed to load history database.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        refreshHistory();
    }, [refreshHistory]);

    const addRecord = async (record: CropAnalysisRecord) => {
        // Optimistic Update: Update UI immediately before DB confirms
        setHistory(prev => [record, ...prev]);
        try {
            await HistoryService.saveRecord(record);
        } catch (err) {
            // Revert optimistic update on failure
            setHistory(prev => prev.filter(r => r.id !== record.id));
            setError('Failed to save record.');
            throw err;
        }
    };

    const removeRecord = async (id: string) => {
        const backup = [...history];
        setHistory(prev => prev.filter(r => r.id !== id));
        try {
            await HistoryService.deleteRecord(id);
        } catch (_err) {
            setHistory(backup); // Revert
            setError('Failed to delete record.');
        }
    };

    return { history, isLoading, error, addRecord, removeRecord, refreshHistory };
}
