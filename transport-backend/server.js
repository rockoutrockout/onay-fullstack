import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI = 'mongodb+srv://adildb:p8JsyqoGCFBcA9WF@cluster0.pchyd9x.mongodb.net/transport_db?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('📦 База данных MongoDB Atlas успешно СВЯЗАНА!'))
  .catch(err => console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ПОДКЛЮЧЕНИЯ К MONGODB:', err));

// --- СХЕМЫ ДАННЫХ ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['standard', 'student'], default: 'standard' }, 
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

// --- API РОУТЫ ---

app.get('/api/test', (req, res) => {
  res.json({ message: "Бэкенд успешно работает!" });
});

// 1. Регистрация
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role } = req.body; 
  if (!username || !password) {
    return res.status(400).json({ error: 'Заполните все поля!' });
  }

  try {
    // ХАК: Принудительно удаляем проблемный индекс прямо перед регистрацией
    try {
      await mongoose.connection.db.collection('users').dropIndex('userId_1');
      console.log('🗑️ Упрямый индекс userId_1 был успешно СТЕРТ из базы прямо во время запроса!');
    } catch (indexErr) {
      // Игнорируем ошибку, если индекса уже нет
    }

    const candidate = await User.findOne({ username });
    if (candidate) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      role: role === 'student' ? 'student' : 'standard', 
      balance: 2500 
    });

    console.log(`👤 Зарегистрирован пользователь ${username} с тарифом: ${newUser.role}`);
    res.status(201).json({ message: 'Регистрация успешна' });
  } catch (err) {
    console.error('❌ ОШИБКА ВНУТРИ РОУТА РЕГИСТРАЦИИ:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации', details: err.message });
  }
});

// 2. Вход в систему
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) return res.status(400).json({ error: 'Неверный пароль' });

    res.json({ username: user.username, balance: user.balance, role: user.role });
  } catch (err) {
    console.error('❌ Ошибка при входе:', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Данные юзера
app.get('/api/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ username: user.username, balance: user.balance, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// История билетов
app.get('/api/tickets/:username', async (req, res) => {
  try {
    const tickets = await Ticket.find({ username: req.params.username }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка истории билетов' });
  }
});

// 3. Покупка билета
app.post('/api/tickets/buy', async (req, res) => {
  const { username, busNumber } = req.body; 
  if (!username || !busNumber) return res.status(400).json({ error: 'Неполные данные' });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const price = user.role === 'student' ? 50 : 100;

    if (user.balance < price) return res.status(400).json({ error: 'Недостаточно средств' });

    user.balance -= price;
    await user.save();
    
    const now = new Date();
    const newTicket = new Ticket({
      username,
      busNumber,
      ticketType: user.role, 
      price,
      date: now.toLocaleDateString('ru-RU'),
      time: now.toLocaleTimeString('ru-RU').slice(0, 5)
    });
    await newTicket.save();

    res.status(201).json({ message: 'Оплачено', ticket: newTicket, newBalance: user.balance });
  } catch (err) {
    console.error('❌ Ошибка при покупке билета:', err);
    res.status(500).json({ error: 'Ошибка при покупке билета' });
  }
});

// Пополнение баланса
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Бэкенд успешно запущен на порту ${PORT}!`);
});