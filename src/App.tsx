import React, { useState, useEffect } from 'react';
import { UserProfile, UserData, StampInfo, HistoryItem } from './types';
import { STAMP_OPTIONS, PROFILE_CONFIG, MAX_STAMPS } from './constants';
import StampCircle from './components/StampCircle';
import { getCheerMessage } from './services/geminiService';

const HISTORY_PER_PAGE = 50;
// ✅ 使用您提供的正確網址
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

            // 1. 同步名字與頭像
            if (row.userName && row.userName !== 'undefined') target.name = row.userName;
            if (row.avatar && row.avatar !== 'undefined') target.avatar = row.avatar;

            // 2. 根據動作類型執行邏輯
            if (row.type === 'stamp') {
                target.history.push({ type: 'stamp', stampId: row.stampId || 'star', timestamp: row.timestamp });
                target.count++;
                if (target.count >= MAX_STAMPS) {
                    target.count = 0;
                    target.completedSets++;
                }
            } else if (row.type === 'penalty') {
                if (target.count > 0) target.count--;
                // 在歷史紀錄中找最新的 stamp 改為 penalty
                for (let i = target.history.length - 1; i >= 0; i--) {
                    if (target.history[i].type === 'stamp') {
                        target.history[i].type = 'penalty';
                        break;
                    }
                }
            } else if (row.type === 'undo_stamp') {
                // ✅ 雲端撤回邏輯：移除最後一個印章
                for (let i = target.history.length - 1; i >= 0; i--) {
                    if (target.history[i].type === 'stamp') {
                        target.history.splice(i, 1);
                        // 倒退計數器
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
                // ✅ 兌換邏輯修正：只扣 10 點
                let deducted = 0;
                for (let i = 0; i < target.history.length; i++) {
                    if (target.history[i].type === 'stamp') {
                        target.history[i].type = 'redeemed';
                        deducted++;
                        if (deducted >= 10) break; // 扣滿 10 個就停
                    }
                }
                // 重新計算剩餘點數
                const validStamps = target.history.filter((h: HistoryItem) => h.type === 'stamp').length;
                target.count = validStamps % MAX_STAMPS;
                target.completedSets = Math.floor(validStamps / MAX_STAMPS);
            }
          });

          // 演完之後，把最終結果更新到畫面上
          setUserData(tempState);
        }
      } catch (error) {
        console.error("同步失敗:", error);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchSheetData();
    // 設定每 5 秒自動同步一次
    const intervalId = setInterval(fetchSheetData, 5000); 
    return () => clearInterval(intervalId);
  }, []);

  // 輔助函式：發送資料到 Google Sheets
  const syncToSheet = async (type: string, overrideName?: string, overrideAvatar?: string) => {
    const currentData = activeProfile === 'A' ? userData.profileA : userData.profileB;
    const payload = {
      profile: activeProfile,
      userName: overrideName || currentData.name,
      avatar: overrideAvatar || currentData.avatar,
      type: type, 
      x: 0, y: 0,
      timestamp: new Date().toISOString(),
      stampId: selectedStamp.id
    };

    try {
      await fetch(VITE_SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error("上傳失敗", error);
    }
  };

  // --- 操作邏輯區 ---

  const currentProfileData = activeProfile === 'A' ? userData.profileA : userData.profileB;
  const profileInfo = PROFILE_CONFIG[activeProfile];

  const handleAddStamp = async () => {
    setShowImpact(true); setTimeout(() => setShowImpact(false), 300);
    
    let newCount = currentProfileData.count + 1;
    let newCompletedSets = currentProfileData.completedSets;
    if (newCount >= MAX_STAMPS) { newCount = 0; newCompletedSets++; }
    
    const newHistory = [...currentProfileData.history, { type: 'stamp', stampId: selectedStamp.id } as HistoryItem];

    setUserData(prev => ({
      ...prev,
      [activeProfile === 'A' ? 'profileA' : 'profileB']: {
        ...currentProfileData,
        count: newCount,
        completedSets: newCompletedSets,
        history: newHistory
      }
    }));

    syncToSheet('stamp');
    
    setLoadingCheer(true);
    setCheer(await getCheerMessage(currentProfileData.name, newCount === 0 ? 10 : newCount));
    setLoadingCheer(false);
  };

  const handlePenaltyStamp = () => {
    if (currentProfileData.count === 0) return;
    setShowPenaltyImpact(true); setTimeout(() => setShowPenaltyImpact(false), 400);

    const newHistory = [...currentProfileData.history];
    for (let i = newHistory.length - 1; i >= 0; i--) {
        if (newHistory[i].type === 'stamp') { newHistory[i].type = 'penalty'; break; }
    }
    
    setUserData(prev => ({
      ...prev,
      [activeProfile === 'A' ? 'profileA' : 'profileB']: {
        ...currentProfileData,
        count: currentProfileData.count - 1,
        history: newHistory
      }
    }));

    syncToSheet('penalty');
    setCheer("喔不！被扣掉一個印章了 😢");
  };

  const executeReset = () => {
    syncToSheet('reset_all');
    setUserData(prev => ({
      ...prev,
      [activeProfile === 'A' ? 'profileA' : 'profileB']: {
        ...currentProfileData,
        count: 0,
        completedSets: 0,
        history: []
      }
    }));
    setShowResetConfirm(false);
    setCheer('紀錄已歸零，重新開始努力吧！✨');
  };

  const saveName = () => {
    if (tempName.trim()) {
      const newName = tempName.trim();
      setUserData(prev => ({
        ...prev,
        [activeProfile === 'A' ? 'profileA' : 'profileB']: {
          ...currentProfileData,
          name: newName
        }
      }));
      setIsEditingName(false);
      syncToSheet('update_profile', newName); 
    } else {
        setIsEditingName(false);
    }
  };

  const changeAvatar = () => {
    const newUrl = window.prompt("請輸入新的頭像圖片網址：", currentProfileData.avatar || "");
    if (newUrl && newUrl.trim()) {
        const validUrl = newUrl.trim();
        setUserData(prev => ({
            ...prev,
            [activeProfile === 'A' ? 'profileA' : 'profileB']: {
            ...currentProfileData,
            avatar: validUrl
            }
        }));
        syncToSheet('update_profile', undefined, validUrl);
    }
  };

  // ✅ 真正的雲端撤回功能 (無 Alert)
  const handleUndo = () => {
    if (currentProfileData.history.length === 0) return;

    const lastItem = currentProfileData.history[currentProfileData.history.length - 1];
    if (lastItem.type !== 'stamp') {
        alert("只能撤回「蓋章」動作喔！如果是扣分或兌換，請手動調整。");
        return;
    }
     
    // 1. 本地更新 (先讓畫面變)
    const newHistory = [...currentProfileData.history];
    newHistory.pop();

    let newCount = currentProfileData.count;
    let newCompletedSets = currentProfileData.completedSets;

    if (newCount === 0 && newCompletedSets > 0) {
      newCount = MAX_STAMPS - 1;
      newCompletedSets -= 1;
    } else if (newCount > 0) {
      newCount -= 1;
    }

    setUserData(prev => ({
      ...prev,
      [activeProfile === 'A' ? 'profileA' : 'profileB']: {
        ...currentProfileData,
        count: newCount,
        completedSets: newCompletedSets,
        history: newHistory
      }
    }));

    // 2. 發送雲端指令
    syncToSheet('undo_stamp');
    setCheer("已撤回上一步！✨");
  };
  
  // ✅ 修正後的兌換功能
  const handleRedeemGift = () => {
      // 1. 雲端同步
      syncToSheet('redeem_gift');
      
      // 2. 本地預演 (只扣前10個)
      const validStampIndices = currentProfileData.history
      .map((h, i) => (h.type === 'stamp' ? i : -1))
      .filter(i => i !== -1);

      const newHistory = [...currentProfileData.history];
      for (let i = 0; i < 10; i++) {
        const idx = validStampIndices[i];
        if (idx !== undefined) {
             newHistory[idx] = { ...newHistory[idx], type: 'redeemed' };
        }
      }
      
      // 重新計算確保正確
      const validCount = newHistory.filter(h => h.type === 'stamp').length;
      const newCount = validCount % MAX_STAMPS;
      const newSets = Math.floor(validCount / MAX_STAMPS);

      setUserData(prev => ({
        ...prev,
        [activeProfile === 'A' ? 'profileA' : 'profileB']: {
          ...currentProfileData,
          count: newCount,
          completedSets: newSets,
          history: newHistory
        }
      }));
      setGiftStage('closed');
  };

  const handleGiftClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (giftStage === 'closed') {
      setGiftStage('opened');
    } else if (giftStage === 'opened') {
      setGiftStage('none');
    }
  };

  const totalValidStamps = currentProfileData.history.filter(h => h.type === 'stamp').length;
  const startIndex = historyPage * HISTORY_PER_PAGE;
  const maxPages = Math.max(1, Math.ceil(currentProfileData.history.length / HISTORY_PER_PAGE));

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-500 ${profileInfo.bgColor}`}>
        {/* 重置確認視窗 */}
        {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-5xl mb-4 text-center">⚠️</div>
            <h3 className="text-xl font-black text-gray-800 text-center mb-2">確定要全部重置嗎？</h3>
            <p className="text-gray-500 text-center text-sm mb-8 leading-relaxed">
              這將同步清空試算表中的紀錄。重置後 <span className="text-red-500 font-bold">{currentProfileData.name}</span> 的所有資料都將消失。
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={executeReset} className="w-full py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg">是的，全部清空！</button>
              <button onClick={() => setShowResetConfirm(false)} className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">先不要</button>
            </div>
          </div>
        </div>
      )}
      
      {giftStage !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => giftStage === 'opened' && setGiftStage('none')}>
          <div className="text-center px-6" onClick={(e) => e.stopPropagation()}>
            {giftStage === 'closed' ? (
              <div className="flex flex-col items-center">
                <div onClick={handleGiftClick} className="text-[12rem] gift-bounce cursor-pointer hover:scale-110 transition-transform active:scale-95 drop-shadow-[0_20px_50px_rgba(255,255,255,0.3)]">🎁</div>
                <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">你獲得了一個驚喜禮物！</h2>
                <div className="bg-white/10 px-6 py-2 rounded-full backdrop-blur-md mb-8"><p className="text-amber-200 animate-pulse font-bold">點擊禮物盒來打開它 ✨</p></div>
              </div>
            ) : (
              <div className="flex flex-col items-center animate-in zoom-in duration-500" onClick={handleGiftClick}>
                <div className="text-[12rem] mb-8 gift-open-anim relative filter drop-shadow-2xl">🍭<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-6xl confetti-slow">🎉</span></div></div>
                <h2 className="text-5xl font-black text-white drop-shadow-xl mb-4 italic tracking-tight">WOW! 太棒了!</h2>
                <p className="text-2xl text-amber-100 font-bold bg-white/20 px-8 py-3 rounded-2xl backdrop-blur-lg">獎勵自己一個甜甜的時刻吧！🧁</p>
                <p className="mt-12 text-white/40 text-sm font-medium">點擊任意位置關閉</p>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">🧸</span> {view === 'card' ? '集點印章' : '成就回顧'}
            </h1>
            <div className="flex flex-col">
              {saveStatus === '
