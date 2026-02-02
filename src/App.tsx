import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, UserData, StampInfo, HistoryItem } from './types';
import { STAMP_OPTIONS, PROFILE_CONFIG, MAX_STAMPS } from './constants';
import StampCircle from './components/StampCircle';
import { getCheerMessage } from './services/geminiService';

const HISTORY_PER_PAGE = 50;
const VITE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwKQIF6EbuzifPKhOgVWv74Ia1xruzC7mE-uLY0aYNmPrnnsLEpPGexNWduM9VAc84gCQ/exec";

const App: React.FC = () => {
  const [activeProfile, setActiveProfile] = useState<UserProfile>('A');
  const [view, setView] = useState<'card' | 'history'>('card');
  const [historyPage, setHistoryPage] = useState(0);
  
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

  // 🔄 核心同步邏輯
  const fetchSheetData = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;

    setIsSyncing(true);
    try {
      const response = await fetch(VITE_SHEET_API_URL);
      const data = await response.json();
      
      if (Array.isArray(data)) {
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
      console.error("同步失敗:", error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchSheetData();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    fetchSheetData();
    const intervalId = setInterval(fetchSheetData, 30000); 
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchSheetData]);

  const syncToSheet = async (type: string, overrideName?: string, overrideAvatar?: string) => {
    const currentData = activeProfile === 'A' ? userData.profileA : userData.profileB;
    const payload = {
      profile: activeProfile,
      userName: overrideName || currentData.name,
      avatar: overrideAvatar || currentData.avatar,
      type: type, 
      timestamp: new Date().toISOString(),
      stampId: selectedStamp.id
    };
    try {
      setSaveStatus('saving');
      await fetch(VITE_SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('none'), 2000);
    } catch (error) {
      console.error("上傳失敗", error);
      setSaveStatus('none');
    }
  };

  const currentProfileData = activeProfile === 'A' ? userData.profileA : userData.profileB;
  const profileInfo = PROFILE_CONFIG[activeProfile];

  const handleAddStamp = async () => {
    setShowImpact(true); setTimeout(() => setShowImpact(false), 300);
    let newCount = currentProfileData.count + 1;
    let newCompletedSets = currentProfileData.completedSets;
    if (newCount >= MAX_STAMPS) { newCount = 0; newCompletedSets++; }
    
    const newHistoryEntry: HistoryItem = { 
      type: 'stamp', 
      stampId: selectedStamp.id, 
      timestamp: new Date().toISOString() 
    };
    const newHistory = [...currentProfileData.history, newHistoryEntry];

    setUserData(prev => ({
      ...prev,
      [activeProfile === 'A' ? 'profileA' : 'profileB']: { ...currentProfileData, count: newCount, completedSets: newCompletedSets, history: newHistory }
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
    setUserData(prev => ({ ...prev, [activeProfile === 'A' ? 'profileA' : 'profileB']: { ...currentProfileData, count: currentProfileData.count - 1, history: newHistory } }));
    syncToSheet('penalty');
    setCheer("喔不！被扣掉一個印章了 😢");
  };

  const executeReset = () => {
    syncToSheet('reset_all');
    setUserData(prev => ({ ...prev, [activeProfile === 'A' ? 'profileA' : 'profileB']: { ...currentProfileData, count: 0, completedSets: 0, history: [] } }));
    setShowResetConfirm(false);
    setCheer('紀錄已歸零，重新開始努力吧！✨');
  };

  const saveName = () => {
    if (tempName.trim()) {
      const newName = tempName.trim();
      setUserData(prev => ({ ...prev, [activeProfile === 'A' ? 'profileA' : 'profileB']: { ...currentProfileData, name: newName } }));
      setIsEditingName(false);
      syncToSheet('update_profile', newName); 
    } else setIsEditingName(false);
  };

  const changeAvatar = () => {
    const newUrl = window.prompt("請輸入新的頭像圖片網址：", currentProfileData.avatar || "");
    if (newUrl && newUrl.trim()) {
        const validUrl = newUrl.trim();
        setUserData(prev => ({ ...prev, [activeProfile === 'A' ? 'profileA' : 'profileB']: { ...currentProfileData, avatar: validUrl } }));
        syncToSheet('update_profile', undefined, validUrl);
    }
  };

  const handleUndo = () => {
    if (currentProfileData.history.length === 0) return;
    const lastItem = currentProfileData.history[currentProfileData.history.length - 1];
    if (lastItem.type !== 'stamp') return;
    const newHistory = [...currentProfileData.history];
    newHistory.pop();
    let newCount = currentProfileData.count;
    let newCompletedSets = currentProfileData.completedSets;
    if (newCount === 0 && newCompletedSets > 0) { newCount = MAX_STAMPS - 1; newCompletedSets -= 1; }
    else if (newCount > 0) newCount -= 1;
    setUserData(prev => ({ ...prev, [activeProfile === 'A' ? 'profileA' : 'profileB']: { ...currentProfileData, count: newCount, completedSets: newCompletedSets, history: newHistory } }));
    syncToSheet('undo_stamp');
    setCheer("已撤回上一步！✨");
  };
  
  const handleRedeemGift = () => {
      syncToSheet('redeem_gift');
      const validStampIndices = currentProfileData.history.map((h, i) => (h.type === 'stamp' ? i : -1)).filter(i => i !== -1);
      const newHistory = [...currentProfileData.history];
      for (let i = 0; i < 10; i++) {
        const idx = validStampIndices[i];
        if (idx !== undefined) newHistory[idx] = { ...newHistory[idx], type: 'redeemed' };
      }
      const validCount = newHistory.filter(h => h.type === 'stamp').length;
      setUserData(prev => ({ ...prev, [activeProfile === 'A' ? 'profileA' : 'profileB']: { ...currentProfileData, count: validCount % MAX_STAMPS, completedSets: Math.floor(validCount / MAX_STAMPS), history: newHistory } }));
      setGiftStage('closed');
  };

  const totalValidStamps = currentProfileData.history.filter(h => h.type === 'stamp').length;
  const startIndex = historyPage * HISTORY_PER_PAGE;
  const maxPages = Math.max(1, Math.ceil(currentProfileData.history.length / HISTORY_PER_PAGE));

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-500 ${profileInfo.bgColor}`}>
        {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-black text-gray-800 text-center mb-2">確定要全部重置嗎？</h3>
            <div className="flex flex-col gap-3">
              <button onClick={executeReset} className="w-full py-4 bg-red-500 text-white rounded-2xl font-black">是的，全部清空！</button>
              <button onClick={() => setShowResetConfirm(false)} className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">先不要</button>
            </div>
          </div>
        </div>
      )}
      
      {giftStage !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={() => giftStage === 'opened' && setGiftStage('none')}>
          <div className="text-center px-6">
            {giftStage === 'closed' ? (
              <div onClick={() => setGiftStage('opened')} className="flex flex-col items-center cursor-pointer">
                <div className="text-[12rem] gift-bounce">🎁</div>
                <h2 className="text-4xl font-black text-white">你獲得了一個驚喜禮物！</h2>
              </div>
            ) : (
              <div className="flex flex-col items-center" onClick={() => setGiftStage('none')}>
                <div className="text-[12rem] mb-8">🍭</div>
                <h2 className="text-5xl font-black text-white">WOW! 太棒了!</h2>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-800"><span className="text-2xl">🧸</span> {view === 'card' ? '集點印章' : '成就回顧'}</h1>
            <div className="flex flex-col">
              {saveStatus === 'saved' && <div className="text-[10px] text-green-500 font-bold bg-green-50 px-2 py-0.5 rounded-full">已存檔</div>}
              {isSyncing && <div className="text-[10px] text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">同步中...</div>}
            </div>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-full">
            {(['A', 'B'] as UserProfile[]).map((p) => (
              <button key={p} onClick={() => { setActiveProfile(p); setIsEditingName(false); setHistoryPage(0); }} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${activeProfile === p ? `${PROFILE_CONFIG[p].accentColor} text-white shadow-md` : 'text-gray-400'}`}>
                {userData[p === 'A' ? 'profileA' : 'profileB'].name}
              </button>
            ))}
          </div>
        </div>
      </header>
      
      <main className="max-w-xl mx-auto px-4 mt-6">
        {view === 'card' ? (
          <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-white relative overflow-hidden">
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="relative cursor-pointer" onClick={changeAvatar}>
                    <img src={currentProfileData.avatar || profileInfo.avatar} className="w-16 h-16 rounded-3xl object-cover ring-4 ring-gray-50 shadow-md" alt="avatar" />
                  </div>
                  <div className="flex flex-col">
                    {isEditingName ? (
                      <input autoFocus value={tempName} onChange={(e) => setTempName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && saveName()} className="border-b-4 border-amber-300 outline-none w-36 px-1 text-2xl font-black bg-transparent" />
                    ) : (
                      <h2 onClick={() => { setTempName(currentProfileData.name); setIsEditingName(true); }} className={`text-2xl font-black cursor-pointer ${profileInfo.primaryColor}`}>{currentProfileData.name}</h2>
                    )}
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">目前進度: {currentProfileData.count === 0 && currentProfileData.history.filter(h => h.type === 'stamp').length % MAX_STAMPS === 0 && currentProfileData.history.filter(h => h.type === 'stamp').length > 0 ? '10' : currentProfileData.count}/10</p>
                  </div>
                </div>
                {currentProfileData.completedSets > 0 && <div className="flex -space-x-3">{Array.from({ length: Math.min(currentProfileData.completedSets, 3) }).map((_, i) => (<div key={i} className="w-12 h-12 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center text-2xl shadow-sm rotate-12">🏆</div>))}</div>}
              </div>

              <div className={`min-h-[64px] flex items-center justify-center px-4 py-3 rounded-[1.5rem] border-2 border-dashed ${profileInfo.bgColor} ${profileInfo.primaryColor.replace('text-', 'border-')} border-opacity-40 mb-8 text-center`}>
                <p className="italic font-bold text-gray-700 text-sm">{loadingCheer ? "正在寫信..." : cheer || "開始集點吧！✨"}</p>
              </div>

              {/* 🍓 修正後的印章格子顯示區：處理第十點消失的問題 */}
              <div className={`grid grid-cols-5 gap-4 mb-10 justify-items-center relative ${showImpact || showPenaltyImpact ? 'shake' : ''}`}>
                {Array.from({ length: MAX_STAMPS }).map((_, i) => {
                  const allValidStamps = currentProfileData.history.filter(h => h.type === 'stamp');
                  
                  // ✅ 核心修正：判斷是否正處於「剛蓋滿 10 點」的瞬間
                  const isJustCompleted = currentProfileData.count === 0 && 
                                        allValidStamps.length > 0 && 
                                        allValidStamps.length % MAX_STAMPS === 0;
                  
                  const setOffset = isJustCompleted 
                    ? (currentProfileData.completedSets - 1) * MAX_STAMPS 
                    : currentProfileData.completedSets * MAX_STAMPS;

                  const stampRecord = allValidStamps[setOffset + i];
                  const displayEmoji = stampRecord 
                    ? STAMP_OPTIONS.find(s => s.id === stampRecord.stampId)?.emoji 
                    : selectedStamp.emoji;

                  // 如果是剛蓋滿，10 格全部亮起；否則按 count 數量亮起
                  const isStamped = isJustCompleted ? true : i < currentProfileData.count;

                  return (
                    <StampCircle 
                      key={i} 
                      index={i} 
                      isStamped={isStamped} 
                      emoji={displayEmoji || '⭐'} 
                    />
                  );
                })}
                {showImpact && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"><span className="text-[10rem] impact-animation">{selectedStamp.emoji}</span></div>}
                {showPenaltyImpact && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"><span className="text-[12rem] impact-animation text-red-500 font-black opacity-80">✕</span></div>}
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                    <button onClick={handleAddStamp} className={`flex-[3] py-5 rounded-3xl font-black text-2xl shadow-xl active:scale-95 ${profileInfo.accentColor} text-white`}>蓋印章！ {selectedStamp.emoji}</button>
                    <button onClick={handleUndo} disabled={currentProfileData.history.length === 0} className="flex-1 py-5 rounded-3xl bg-gray-100 text-gray-400 flex flex-col items-center justify-center shadow-md active:scale-90">
                      <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                      <span className="text-[10px] font-bold">撤回</span>
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={handlePenaltyStamp} disabled={currentProfileData.count === 0} className={`py-4 rounded-2xl font-bold text-sm border-2 ${currentProfileData.count === 0 ? 'border-gray-100 text-gray-200' : 'border-red-100 text-red-500'}`}>❌ 扣一點</button>
                  <button onClick={() => setShowResetConfirm(true)} className="py-4 rounded-2xl text-white bg-gray-400 font-black text-sm shadow-md">♻️ 重置全部</button>
                </div>
              </div>
            </div>

            <section className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-7 border border-white shadow-lg">
              <h3 className="text-gray-400 font-black mb-5 text-xs uppercase tracking-widest">選擇款式</h3>
              <div className="grid grid-cols-6 gap-3">{STAMP_OPTIONS.map((stamp) => (<button key={stamp.id} onClick={() => setSelectedStamp(stamp)} className={`aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all ${selectedStamp.id === stamp.id ? `ring-4 ring-offset-4 ring-gray-300 scale-110 shadow-xl ${stamp.color}` : 'bg-white shadow-sm'}`}>{stamp.emoji}</button>))}</div>
            </section>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-white min-h-[580px] flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner bg-amber-50">🏆</div><div><h2 className="text-2xl font-black text-gray-800">成就榜</h2><p className="text-sm font-bold text-gray-400">有效累積: {totalValidStamps} 個</p></div></div>
              <button onClick={handleRedeemGift} disabled={totalValidStamps < 10} className={`px-6 py-3 rounded-2xl font-black text-sm shadow-xl ${totalValidStamps >= 10 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : 'bg-gray-100 text-gray-300'}`}>🎁 兌換獎勵</button>
            </div>
            <div className="bg-gray-50/70 p-7 rounded-[2rem] mb-8 flex-grow shadow-inner border border-gray-100 overflow-y-auto">
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 justify-items-center">
                {Array.from({ length: HISTORY_PER_PAGE }).map((_, i) => {
                  const globalIdx = startIndex + i;
                  const historyItem = currentProfileData.history[globalIdx];
                  const stampEmoji = historyItem ? STAMP_OPTIONS.find(s => s.id === historyItem.stampId)?.emoji || '✨' : '';
                  const isVoid = historyItem?.type === 'penalty' || historyItem?.type === 'redeemed';
                  return (<div key={i} className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl transition-all relative ${historyItem ? 'bg-white shadow-md border border-gray-100' : 'bg-gray-200/30 border border-dashed'}`}>{historyItem && (<><span className={`${isVoid ? 'grayscale opacity-20 scale-90' : 'stamp-pop'}`}>{stampEmoji}</span>{isVoid && <div className="absolute inset-0 flex items-center justify-center"><span className="text-red-500 font-black text-3xl">✕</span></div>}</>)}</div>);
                })}
              </div>
            </div>
            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              <button onClick={() => setHistoryPage(p => Math.max(0, p - 1))} disabled={historyPage === 0} className="px-5 py-2.5 rounded-2xl text-sm font-black text-gray-600">⬅️ 上一頁</button>
              <span className="text-lg font-black text-gray-800">{historyPage + 1} / {maxPages}</span>
              <button onClick={() => setHistoryPage(p => Math.min(maxPages - 1, p + 1))} disabled={historyPage >= maxPages - 1} className="px-5 py-2.5 rounded-2xl text-sm font-black text-gray-600">下一頁 ➡️</button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-8 py-4 z-40 shadow-lg">
        <div className="max-w-xl mx-auto flex justify-around items-center">
          <button onClick={() => setView('card')} className={`flex flex-col items-center gap-1.5 ${view === 'card' ? profileInfo.primaryColor : 'text-gray-400'}`}>
            <div className={`p-2.5 rounded-[1.25rem] ${view === 'card' ? `${profileInfo.bgColor}` : ''}`}><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
            <span className="text-[11px] font-black uppercase">我的卡片</span>
          </button>
          <button onClick={() => setView('history')} className={`flex flex-col items-center gap-1.5 ${view === 'history' ? profileInfo.primaryColor : 'text-gray-400'}`}>
            <div className={`p-2.5 rounded-[1.25rem] ${view === 'history' ? `${profileInfo.bgColor}` : ''}`}><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
            <span className="text-[11px] font-black uppercase">成就榜</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
