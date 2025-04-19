const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

// Middleware для проверки JWT
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Нет токена' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Неверный токен' });
  }
}

// Получить историю чата (последние 100 сообщений)
router.get('/history', auth, async (req, res) => {
  const { psychologist } = req.query;
  if (!psychologist) return res.status(400).json({ message: 'Не указан психолог' });
  try {
    const messages = await Message.find({ userId: req.user.userId, psychologist })
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка получения истории' });
  }
});

// Отправить новое сообщение
router.post('/send', auth, async (req, res) => {
  const { psychologist, role, content } = req.body;
  if (!psychologist || !role || !content) return res.status(400).json({ message: 'Не все поля заполнены' });
  try {
    const message = new Message({
      userId: req.user.userId,
      psychologist,
      role,
      content
    });
    await message.save();

    // Лимитируем историю: оставляем только 100 последних сообщений
    const count = await Message.countDocuments({ userId: req.user.userId, psychologist });
    if (count > 100) {
      const oldMessages = await Message.find({ userId: req.user.userId, psychologist })
        .sort({ createdAt: 1 })
        .limit(count - 100);
      const ids = oldMessages.map(m => m._id);
      await Message.deleteMany({ _id: { $in: ids } });
    }
    res.json({ message: 'Сообщение сохранено' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сохранения сообщения' });
  }
});

// Очистить чат
router.delete('/clear', auth, async (req, res) => {
  const { psychologist } = req.body;
  if (!psychologist) return res.status(400).json({ message: 'Не указан психолог' });
  try {
    await Message.deleteMany({ userId: req.user.userId, psychologist });
    res.json({ message: 'Чат очищен' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка очистки чата' });
  }
});

module.exports = router;
