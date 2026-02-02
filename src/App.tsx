import React, { useState, useEffect } from 'react';
import { UserProfile, UserData, StampInfo, HistoryItem } from './types';
import { STAMP_OPTIONS, PROFILE_CONFIG, MAX_STAMPS } from './constants';
import StampCircle from './components/StampCircle';
import { getCheerMessage } from './services/geminiService';

const HISTORY_PER_PAGE = 50;
// ✅ 保持您原本提供的正確網址
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

          // 創建一個空的暫存狀態，準備從頭開始「演」一遍
          let tempState = {
            profileA: { name: 'Brownie', count: 0, completedSets: 0, history: [] as HistoryItem[], avatar: 'https://picsum.photos/id/237/200/200' },
            profileB: { name: 'Snowy', count: 0, completedSets: 0, history: [] as HistoryItem[], avatar: 'https://picsum.photos/id/1025/200/200' }
          };

          // 依序讀取每一行資料 (時間越早的越前面)
          data.forEach((row: any) => {
            const p = row.profile === 'B' ? 'profileB' : 'profileA'; // 判斷是誰的操作
            const target = tempState[p];

            // 1. 同步名字與頭像 (如果該行資料有紀錄名字，就更新)
            if (row.userName && row.userName !== 'undefined') target.name = row.userName;
            if (row.avatar && row.avatar !== 'undefined') target.avatar = row.avatar;

            // 2. 根據動作類型執行邏輯
            if (row.type === 'stamp') {
                target.history.push({ type: 'stamp', stampId: row
