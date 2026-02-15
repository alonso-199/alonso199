import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_RECORDINGS_KEY = 'pending_voice_recordings';

export interface PendingRecording {
  id: string;
  uri: string;
  createdAt: string;
  description?: string;
}

export async function loadPendingRecordings(): Promise<PendingRecording[]> {
  try {
    const stored = await AsyncStorage.getItem(PENDING_RECORDINGS_KEY);
    const recordings = stored ? JSON.parse(stored) as PendingRecording[] : [];
    console.log('[PendingRecordings] Loaded', recordings.length, 'pending recordings');
    return recordings;
  } catch (error) {
    console.error('[PendingRecordings] Error loading:', error);
    return [];
  }
}

export async function savePendingRecording(recording: PendingRecording): Promise<void> {
  try {
    const existing = await loadPendingRecordings();
    const updated = [recording, ...existing];
    await AsyncStorage.setItem(PENDING_RECORDINGS_KEY, JSON.stringify(updated));
    console.log('[PendingRecordings] Saved recording:', recording.id);
  } catch (error) {
    console.error('[PendingRecordings] Error saving:', error);
    throw error;
  }
}

export async function deletePendingRecording(id: string): Promise<void> {
  try {
    const existing = await loadPendingRecordings();
    const updated = existing.filter(r => r.id !== id);
    await AsyncStorage.setItem(PENDING_RECORDINGS_KEY, JSON.stringify(updated));
    console.log('[PendingRecordings] Deleted recording:', id);
  } catch (error) {
    console.error('[PendingRecordings] Error deleting:', error);
    throw error;
  }
}
