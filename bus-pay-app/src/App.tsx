import React, { useState, useEffect } from 'react';
import { Bus, QrCode, Wallet, ArrowLeft, Clock, Check, History, ChevronRight, Plus, X, LogOut, User as UserIcon, Lock, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import QrScanner from './QrScanner';

interface ITicket {
  id: string;
  busNumber: string;
  ticketType: 'standard' | 'student';
  price: number;
  date: string;
  time: string;
}

export default function App() {
  const API_BASE_URL = 'http://localhost:5000/api'; 

  // --- АВТОРИЗАЦИЯ С ЛОКАЛЬНЫМ ХРАНИЛИЩЕМ ---
  // При старте проверяем, есть ли сохраненный юзер в localStorage
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('onay_username');
  });
  
  const [currentUserRole, setCurrentUserRole] = useState<'standard' | 'student'>(() => {
    return (localStorage.getItem('onay_role') as 'standard' | 'student') || 'standard';
  });

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authRole, setAuthRole] = useState<'standard' | 'student'>('standard');

  // Приложение
  const [activeTab, setActiveTab] = useState<'pay' | 'tickets'>('pay');
  const [busNumber, setBusNumber] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isScanning, setIsScanning] = useState(false);
  const [activeTicketData, setActiveTicketData] = useState<any>(null);
  
  const [balance, setBalance] = useState<number>(0);
  const [ticketHistory, setTicketHistory] = useState<ITicket[]>([]);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  // Платежная система
  const [paymentStep, setPaymentStep] = useState<'amount' | 'card' | 'processing' | 'success'>('amount');
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  // Подгрузка данных пользователя (срабатывает и при перезагрузке, если юзер есть)
  useEffect(() => {
    if (!currentUser) return;

    async function fetchUserData() {
      try {
        const userRes = await fetch(`${API_BASE_URL}/user/${currentUser}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          setBalance(userData.balance);
          setCurrentUserRole(userData.role);
          // На всякий случай обновляем роль в хранилище, если она изменилась на бэкенде
          localStorage.setItem('onay_role', userData.role);
        }
        const ticketsRes = await fetch(`${API_BASE_URL}/tickets/${currentUser}`);
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          setTicketHistory(ticketsData);
        }
      } catch (err) {
        console.error('Ошибка синхронизации данных:', err);
      }
    }
    fetchUserData();
  }, [currentUser]);

  useEffect(() => {
    let timer: any;
    if (isPaid) timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isPaid]);

  // Авторизация / Регистрация
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword.trim()) {
      alert('Заполните все поля!');
      return;
    }

    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const bodyData = authMode === 'login' 
      ? { username: authUsername, password: authPassword }
      : { username: authUsername, password: authPassword, role: authRole };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Ошибка');
        return;
      }

      if (authMode === 'register') {
        alert('Регистрация успешна! Теперь войдите.');
        setAuthMode('login');
        setAuthPassword('');
      } else {
        // ЗАПОМИНАЕМ ПОЛЬЗОВАТЕЛЯ НАВСЕГДА (до выхода)
        localStorage.setItem('onay_username', data.username);
        localStorage.setItem('onay_role', data.role);

        setCurrentUser(data.username);
        setBalance(data.balance);
        setCurrentUserRole(data.role);
      }
    } catch (err) {
      alert('Ошибка бэкенда');
    }
  };

  // Выход из аккаунта (Очищаем память браузера)
  const handleLogout = () => {
    localStorage.removeItem('onay_username');
    localStorage.removeItem('onay_role');
    
    setCurrentUser(null);
    setAuthUsername('');
    setAuthPassword('');
    setTicketHistory([]);
    setIsPaid(false);
  };

  // Покупка билета
  const handlePayment = async (targetBus: string) => {
    if (!targetBus.trim()) {
      alert('Введите номер автобуса');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/tickets/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, busNumber: targetBus })
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Ошибка');
        return;
      }

      setBalance(data.newBalance);
      setTicketHistory(prev => [data.ticket, ...prev]);
      setActiveTicketData(data.ticket);
      setIsPaid(true);
    } catch (err) {
      alert('Ошибка соединения');
    }
  };

  const handleTopUp = async (amount: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/user/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, amount })
      });
      const data = await response.json();
      if (response.ok) {
        setBalance(data.newBalance);
        setPaymentStep('success');
      }
    } catch (err) {
      alert('Ошибка');
    }
  };

  const closeTopUpModal = () => {
    setIsTopUpOpen(false);
    setPaymentStep('amount');
    setTopUpAmount('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvc('');
  };

  // --- ЭКРАН ВХОДА И РЕГИСТРАЦИИ ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex justify-center items-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.03)] p-8 border border-[#e8e8ed] space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 mb-1">
              <Bus className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
              {authMode === 'login' ? 'Вход в ONAY!' : 'Создать аккаунт'}
            </h2>
            <p className="text-xs text-[#86868b]">Электронная система билетирования</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#86868b] ml-1">Имя пользователя</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b] w-4 h-4" />
                <input type="text" placeholder="Ваш логин" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-xl p-3.5 pl-12 text-[#1d1d1f] text-sm focus:outline-none focus:bg-white" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#86868b] ml-1">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b] w-4 h-4" />
                <input type="password" placeholder="Ваш пароль" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-xl p-3.5 pl-12 text-[#1d1d1f] text-sm focus:outline-none focus:bg-white" />
              </div>
            </div>

            {authMode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#86868b] ml-1">Выберите тип карты</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setAuthRole('standard')} className={`p-3 rounded-xl border text-center text-xs font-semibold cursor-pointer transition-all ${authRole === 'standard' ? 'border-[#1d1d1f] bg-[#f5f5f7] text-[#1d1d1f]' : 'border-[#e8e8ed] text-slate-400'}`}>Единая (100 ₸)</button>
                  <button type="button" onClick={() => setAuthRole('student')} className={`p-3 rounded-xl border text-center text-xs font-semibold cursor-pointer transition-all ${authRole === 'student' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-[#e8e8ed] text-slate-400'}`}>Студент (50 ₸)</button>
                </div>
              </div>
            )}

            <button type="submit" className="w-full py-3.5 bg-[#1d1d1f] hover:bg-[#2d2d30] text-white rounded-xl text-sm font-medium shadow-sm transition-all cursor-pointer">
              {authMode === 'login' ? 'Войти в профиль' : 'Подтвердить регистрацию'}
            </button>
          </form>

          <div className="text-center">
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-indigo-600 font-medium hover:underline cursor-pointer">
              {authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- ЭКРАН АКТИВНОГО БИЛЕТА ---
  if (isPaid && activeTicketData) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex justify-center items-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.05)] overflow-hidden border border-[#e8e8ed]">
          <div className="bg-[#1d1d1f] p-6 text-white flex justify-between items-center">
            <button onClick={() => { setIsPaid(false); setBusNumber(''); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#86868b]">Городской транспорт</p>
              <p className="text-sm font-medium text-white">Электронный билет</p>
            </div>
          </div>
          <main className="p-8 space-y-6">
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">Маршрут</p>
              <h2 className="text-5xl font-bold tracking-tighter text-[#1d1d1f]">Автобус №{activeTicketData.busNumber}</h2>
            </div>
            <div className="grid grid-cols-2 gap-y-4 pt-4 border-t border-[#f5f5f7] text-sm">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] mb-0.5">Пассажир</p><p className="font-medium text-[#1d1d1f]">{currentUser}</p></div>
              <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] mb-0.5">Тариф карты</p><p className="font-bold text-indigo-600">{activeTicketData.ticketType === 'student' ? 'Студенческий' : 'Обычный'}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] mb-0.5">Дата поездки</p><p className="font-medium text-[#1d1d1f]">{activeTicketData.date}</p></div>
              <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] mb-0.5">Стоимость</p><p className="font-bold text-slate-800">{activeTicketData.price} ₸</p></div>
            </div>
            <div className="relative border-t-2 border-dashed border-[#e8e8ed] py-1 my-2">
              <div className="absolute -left-12 -top-3 w-6 h-6 bg-[#f5f5f7] rounded-full border border-r-[#e8e8ed]"></div>
              <div className="absolute -right-12 -top-3 w-6 h-6 bg-[#f5f5f7] rounded-full border border-l-[#e8e8ed]"></div>
            </div>
            <div className="space-y-6">
              <div className="bg-[#f5f5f7] p-3 rounded-xl flex items-center justify-between px-4">
                <div className="flex items-center gap-2 text-[#86868b]"><Clock className="w-4 h-4" /><span className="text-xs font-medium">Время контроля:</span></div>
                <span className="text-base font-mono font-bold text-[#1d1d1f]">{currentTime.toLocaleTimeString('ru-RU')}</span>
              </div>
              <div className="bg-white border border-[#e8e8ed] p-5 rounded-3xl flex justify-center"><QrCode className="w-44 h-44 text-[#1d1d1f]" strokeWidth={1.2} /></div>
            </div>
          </main>
          <footer className="p-6 pt-0 text-center"><div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-full"><Check className="w-4 h-4" /> Билет активен</div></footer>
        </div>
      </div>
    );
  }

  // --- ГЛАВНЫЙ ЭКРАН ТРАНСПОРТНОЙ КАРТЫ ---
  return (
    <div className="min-h-screen bg-[#f5f5f7] flex justify-center items-center p-4 relative">
      <div className="w-full max-w-md bg-white min-h-[800px] rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.03)] flex flex-col justify-between overflow-hidden border border-[#e8e8ed]">
        
        <header className="p-6 pb-4 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 text-[#86868b]">
              <p className="text-[10px] font-bold uppercase tracking-widest">Профиль: {currentUser}</p>
              <button onClick={handleLogout} className="p-1 text-rose-500 hover:bg-rose-50 rounded-full cursor-pointer"><LogOut className="w-3 h-3" /></button>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
                {balance} <span className="text-sm font-normal text-[#86868b]">₸</span>
              </h1>
              <button onClick={() => setIsTopUpOpen(true)} className="p-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e8e8ed] rounded-full text-[#1d1d1f] transition-all cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="w-10 h-10 bg-[#f5f5f7] border border-[#e8e8ed] flex items-center justify-center rounded-xl text-[#1d1d1f]"><Wallet className="w-5 h-5" /></div>
        </header>

        <main className="flex-1 p-6 pt-2 space-y-8">
          {activeTab === 'pay' ? (
            <div className="space-y-8">
              <div className="space-y-1.5">
                <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">Оплата проезда</h2>
                <p className="text-sm text-[#86868b]">Зарегистрируйте поездку в два клика</p>
              </div>

              <button onClick={() => setIsScanning(true)} className="group w-full bg-[#1d1d1f] text-white rounded-2xl p-5 flex items-center justify-between shadow-md cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><QrCode className="w-5 h-5 text-white" /></div>
                  <div className="text-left"><p className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">Камера</p><p className="text-base font-medium">Сканировать QR-код</p></div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30" />
              </button>

              <div className="flex items-center text-slate-400 my-2"><div className="flex-grow border-t border-[#e8e8ed]"></div><span className="mx-4 text-[10px] font-bold uppercase tracking-widest text-[#86868b]">или ручной ввод</span><div className="flex-grow border-t border-[#e8e8ed]"></div></div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#86868b] ml-1 block">Бортовой номер автобуса</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b]"><Bus className="w-4 h-4" /></div>
                    <input type="number" placeholder="Например: 4012" value={busNumber} onChange={(e) => setBusNumber(e.target.value)} className="w-full bg-[#f5f5f7] border border-[#e8e8ed] rounded-xl p-3.5 pl-12 font-medium text-sm text-[#1d1d1f]" />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-dashed border-[#e8e8ed] bg-[#f5f5f7]/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 ${currentUserRole === 'student' ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span className="text-xs font-semibold text-slate-600">Ваш фиксированный тариф:</span>
                  </div>
                  <span className="text-sm font-bold text-[#1d1d1f]">
                    {currentUserRole === 'student' ? 'Студенческий (50 ₸)' : 'Обычный (100 ₸)'}
                  </span>
                </div>

                <button onClick={() => handlePayment(busNumber)} className="w-full py-4 bg-[#1d1d1f] hover:bg-[#2d2d30] text-white rounded-xl font-medium text-sm tracking-wide shadow-sm cursor-pointer">
                  Оплатить {currentUserRole === 'student' ? 50 : 100} ₸
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Твои поездки</h2>
              <div className="space-y-2.5">
                {ticketHistory.map((ticket: any) => (
                  <div key={ticket._id || ticket.id} onClick={() => { setActiveTicketData(ticket); setIsPaid(true); }} className="bg-white border border-[#e8e8ed] p-4 rounded-xl flex items-center justify-between hover:bg-[#f5f5f7] transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#f5f5f7] rounded-lg flex items-center justify-center text-[#1d1d1f]"><Bus className="w-4 h-4" /></div>
                      <div><p className="text-sm font-semibold text-[#1d1d1f]">Автобус №{ticket.busNumber}</p><p className="text-[11px] text-[#86868b]">{ticket.date} • {ticket.time}</p></div>
                    </div>
                    <span className="text-sm font-medium text-[#1d1d1f] font-mono">-{ticket.price} ₸</span>
                  </div>
                ))}
                {ticketHistory.length === 0 && (
                  <p className="text-xs text-center text-slate-400 pt-8 uppercase tracking-wider">История поездок пуста</p>
                )}
              </div>
            </div>
          )}
        </main>

        <nav className="p-6 pt-4 flex justify-center gap-16 border-t border-[#f5f5f7] bg-white">
          <button onClick={() => setActiveTab('pay')} className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'pay' ? 'text-indigo-600 font-medium' : 'text-[#86868b]'}`}><QrCode className="w-5 h-5" /><span className="text-[10px] font-bold tracking-wider uppercase">Оплата</span></button>
          <button onClick={() => setActiveTab('tickets')} className={`flex flex-col items-center gap-1 cursor-pointer ${activeTab === 'tickets' ? 'text-indigo-600 font-medium' : 'text-[#86868b]'}`}><History className="w-5 h-5" /><span className="text-[10px] font-bold tracking-wider uppercase">История</span></button>
        </nav>

        {isScanning && <QrScanner onScanSuccess={(t) => { setIsScanning(false); setBusNumber(t); handlePayment(t); }} onClose={() => setIsScanning(false)} />}
      </div>

      {/* ШЛЮЗ */}
      {isTopUpOpen && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="w-full bg-white rounded-t-[2.5rem] p-6 space-y-6 shadow-2xl border-t border-[#e8e8ed] text-[#1d1d1f]">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Пополнение баланса</h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Защищенный шлюз SecurePay</p>
              </div>
              <button onClick={closeTopUpModal} className="p-1.5 bg-[#f5f5f7] rounded-full text-[#86868b] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {paymentStep === 'amount' && (
              <div className="space-y-4">
                <input type="number" placeholder="Сумма (₸)" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="w-full bg-[#f5f5f7] border border-[#e8e8ed] p-3.5 rounded-xl font-bold text-lg text-indigo-600 focus:outline-none" />
                <div className="grid grid-cols-3 gap-2">
                  {[500, 1000, 2000].map(amt => <button key={amt} onClick={() => setTopUpAmount(amt.toString())} className="py-2.5 bg-[#f5f5f7] text-xs font-semibold rounded-xl cursor-pointer">+{amt} ₸</button>)}
                </div>
                <button onClick={() => { if(!topUpAmount || Number(topUpAmount) <= 0) return; setPaymentStep('card'); }} className="w-full py-3.5 bg-[#1d1d1f] text-white rounded-xl font-medium text-sm cursor-pointer">Перейти к карте</button>
              </div>
            )}

            {paymentStep === 'card' && (
              <form onSubmit={(e) => { e.preventDefault(); setPaymentStep('processing'); setTimeout(() => handleTopUp(Number(topUpAmount)), 2000); }} className="space-y-4">
                <div className="w-full bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl p-5 shadow-lg space-y-4">
                  <div className="flex justify-between items-center"><CreditCard className="w-8 h-8 opacity-80" /><span className="text-xs font-mono tracking-widest font-bold bg-white/20 px-2 py-0.5 rounded">Secure</span></div>
                  <div><span className="text-[9px] text-white/60 block uppercase">Номер карты</span><span className="font-mono text-base tracking-widest font-bold">{cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}</span></div>
                </div>
                <input type="text" maxLength={16} placeholder="Номер карты (16 цифр)" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))} className="w-full bg-[#f5f5f7] border border-[#e8e8ed] p-3 rounded-xl font-mono text-sm" required />
                <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer">Списать {topUpAmount} ₸</button>
              </form>
            )}

            {paymentStep === 'processing' && (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                <h4 className="font-bold text-base">Безопасная обработка банком...</h4>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-bounce"><Check className="w-7 h-7" /></div>
                <h4 className="font-bold text-lg text-emerald-600">Успешно пополнено!</h4>
                <button onClick={closeTopUpModal} className="w-full py-3 bg-[#1d1d1f] text-white rounded-xl font-medium text-sm mt-4 cursor-pointer">Вернуться</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}