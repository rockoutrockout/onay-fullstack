import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI = 'mongodb+srv://adildb:p8JsyqoGCFBcA9WF@cluster0.pchyd9x.mongodb.net/transport_db?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('📦 База данных MongoDB Atlas успешно СВЯЗАНА!'))
  .catch(err => console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ПОДКЛЮЧЕНИЯ К MONGODB:', err));

// Обновленная схема: теперь роль (тип тарифа) жестко зафиксирована за аккаунтом
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['standard', 'student'], default: 'standard' }, // ТАРИФ ЮЗЕРА
  balance: { type: Number, required: true, default: 2500 }
});
const User = mongoose.model('User', userSchema);

const ticketSchema = new mongoose.Schema({
  username: { type: String, required: true },
  busNumber: { type: String, required: true },
  ticketType: { type: String, required: true },
  price: { type: Number, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Ticket = mongoose.model('Ticket', ticketSchema);

const app = express();
const PORT = 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// 1. Регистрация с выбором роли (тарифа)
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role } = req.body; // Получаем роль от фронтенда
  if (!username || !password) {
    return res.status(400).json({ error: 'Заполните все поля!' });
  }

  try {
    const candidate = await User.findOne({ username });
    if (candidate) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      role: role === 'student' ? 'student' : 'standard', // Защита значения
      balance: 2500 
    });

    console.log(`👤 Зарегистрирован пользователь ${username} с тарифом: ${newUser.role}`);
    res.status(201).json({ message: 'Регистрация успешна' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// 2. Вход в систему (возвращает роль на фронтенд)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) return res.status(400).json({ error: 'Неверный пароль' });

    res.json({ username: user.username, balance: user.balance, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

app.get('/api/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ username: user.username, balance: user.balance, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

app.get('/api/tickets/:username', async (req, res) => {
  try {
    const tickets = await Ticket.find({ username: req.params.username }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка истории билетов' });
  }
});

// 3. ПОЛНАЯ ЗАЩИТА: Бэкенд сам решает, сколько списать, основываясь на роли из БД!
app.post('/api/tickets/buy', async (req, res) => {
  const { username, busNumber } = req.body; // Фронтенд больше НЕ ПРИСЫЛАЕТ тип тарифа
  if (!username || !busNumber) return res.status(400).json({ error: 'Неполные данные' });

  try {
    // Ищем пользователя в бд, чтобы узнать его реальный статус
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Бэкенд жестко ставит цену сам!
    const price = user.role === 'student' ? 50 : 100;

    if (user.balance < price) return res.status(400).json({ error: 'Недостаточно средств' });

    user.balance -= price;
    await user.save();
    
    const now = new Date();
    const newTicket = new Ticket({
      username,
      busNumber,
      ticketType: user.role, // Записываем тариф из профиля
      price,
      date: now.toLocaleDateString('ru-RU'),
      time: now.toLocaleTimeString('ru-RU').slice(0, 5)
    });
    await newTicket.save();

    res.status(201).json({ message: 'Оплачено', ticket: newTicket, newBalance: user.balance });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка при покупке билета' });
  }
});

app.post('/api/user/topup', async (req, res) => {
  const { username, amount } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Юзер не найден' });
    
    user.balance += Number(amount);
    await user.save();

    res.status(200).json({ message: 'Баланс пополнился', newBalance: user.balance });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка пополнения' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Защищенный бэкенд запущен на http://localhost:${PORT}`);
});