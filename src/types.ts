
export type UserProfile = 'A' | 'B';

export interface HistoryItem {
  type: 'stamp' | 'penalty' | 'redeemed';
  stampId: string;
}

export interface StampData {
  name: string;
  avatar?: string;
  count: number;
  completedSets: number;
  history: HistoryItem[];
  lastStampDate?: string;
}

export interface UserData {
  profileA: StampData;
  profileB: StampData;
}

export interface StampInfo {
  id: string;
  emoji: string;
  color: string;
  label: string;
}
