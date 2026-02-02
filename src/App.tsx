import React, { useState, useEffect } from 'react';
import { UserProfile, UserData, StampInfo, HistoryItem } from './types';
import { STAMP_OPTIONS, PROFILE_CONFIG, MAX_STAMPS } from './constants';
import StampCircle from './components/StampCircle';
import { getCheerMessage } from './services/geminiService';

const HISTORY_PER_PAGE = 50;
// ✅ 您的正確 Apps Script 網址
const VITE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwKQIF6EbuzifPKhOgVWv74Ia1xruzC7mE-uLY0aYNmPrnnsLEpPGexNWduM9VAc84gCQ/exec";

const App: React.FC = () => {
  const [activeProfile, setActiveProfile] = useState<UserProfile>('A');
  const [view, setView] = useState<'card' | 'history'>('card');
  const [historyPage, setHistoryPage] = useState(0);
  
  // 初始化 state
  const [userData, setUserData] = useState<UserData>({
      profileA: { name: 'Brownie', count: 0, completedSets: 0, history: [], avatar: 'https://picsum.photos/id/237/200/200' },
      profileB: { name: 'Snowy', count: 0, completedSets: 0, history: [], avatar: 'https://picsum.photos/id/1025/200/200' }
  });

  const [selectedStamp, setSelectedStamp] = useState<StampInfo>(STAMP_OPTIONS[0]);
  const [cheer, setCheer] = useState<string>('');
  const [loadingCheer, setLoadingCheer] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [showPenaltyImpact, setShowPenaltyImpact] = useState(false);
  const [giftStage, setGiftStage] = useState<'none' | 'closed' | 'opened'>('none');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'none'>('none');

  // 🔥 核心邏輯升級：事件重播 (Event Replay)
  useEffect(() => {
    const fetchSheetData = async () => {
      setIsSyncing(true);
      try {
        const response = await fetch(VITE_SHEET_API_URL);
        const data = await response.json();
        
        if (Array.isArray(data)) {
          console.log("正在重播歷史事件...", data.length + " 筆");

          let tempState = {
            profileA: { name: 'Brownie', count: 0, completedSets: 0, history: [] as HistoryItem[], avatar: 'https://picsum.photos/id/237/200/200' },
            profileB: { name: 'Snowy', count: 0, completedSets: 0, history: [] as HistoryItem[], avatar: 'https://picsum.photos/id/1025/200/200' }
          };

          data.forEach((row: any) => {
            const p = row.profile === 'B' ? 'profileB' : 'profileA';
            const target = tempState[p];

            if (row.userName && row.userName !== 'undefined') target.name = row.userName;
            if (row.avatar && row.avatar !== 'undefined') target.avatar = row.avatar;

            if (row.type === 'stamp') {
                target.history.push({ type: 'stamp', stampId: row.stampId || 'star', timestamp: row.timestamp });
                target.count++;
                if (target.count >= MAX_STAMPS) {
                    target.count = 0;
                    target.completedSets++;
                }
            } else if (row.type === 'penalty') {
                if (target.count > 0) target.count--;
                for (let i = target.history.length - 1; i >= 0; i--) {
                    if (target.history[i].type === 'stamp') {
                        target.history[i].type = 'penalty';
                        break;
                    }
                }
            } else if (row.type === 'undo_stamp') {
                for (let i = target.history.length - 1; i >= 0; i--) {
                    if (target.history[i].type === 'stamp') {
                        target.history.splice(i, 1);
                        if (target.count === 0 && target.completedSets > 0) {
                             target.count = MAX_STAMPS - 1;
                             target.completedSets--;
                        } else if (target.count > 0) {
                             target.count--;
                        }
                        break;
                    }
                }
            } else if (row.type === 'reset_all') {
                target.count = 0;
                target.completedSets = 0;
                target.history = [];
            } else if (row.type === 'redeem_gift') {
                let deducted = 0;
                for (let i = 0; i < target.history.length; i++) {
                    if (target.history[i].type === 'stamp') {
                        target.history[i].type = 'redeemed';
                        deducted++;
                        if (deducted >= 10) break;
                    }
                }
                const validStamps = target.history.filter((h: HistoryItem) => h.type === 'stamp').length;
                target.count = validStamps % MAX_STAMPS;
                target.completedSets = Math.floor(validStamps / MAX_STAMPS);
            }
          });

          setUserData(tempState);
        }
      } catch (error) {
