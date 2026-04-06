const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());

// index.js
// Универсальный маршрут: GET /api/levels/7x7/random
app.get('/crosswordle/api/levels/:mode/random', (req, res) => {
    try {
        const mode = req.params.mode; // Получаем '7x7' или '9x9' из URL
        const filePath = path.join(__dirname, 'levels.json');
        
        if (!fs.existsSync(filePath)) {
            return res.status(500).send("Файл levels.json не найден!");
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Проверяем существование ключа в объекте 'modes'
        if (!data.modes || !data.modes[mode] || data.modes[mode].length === 0) {
            console.error(`Режим ${mode} не найден. Доступные:`, Object.keys(data.modes || {}));
            return res.status(404).json({ error: `Режим ${mode} пуст или не существует` });
        }

        const levels = data.modes[mode];
        const randomLevel = levels[Math.floor(Math.random() * levels.length)];
        
        res.json(randomLevel);
    } catch (err) {
        console.error("Ошибка на сервере:", err);
        res.status(500).send("Ошибка сервера");
    }
});

// Добавь это в index.js
app.use(express.json()); // Чтобы сервер понимал JSON в POST-запросах

// Сохранение/Обновление уровня
app.post('/crosswordle/api/levels', (req, res) => {
    const newLevel = req.body;
    const filePath = path.join(__dirname, 'levels.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const mode = `${newLevel.gridSize.rows}x${newLevel.gridSize.cols}`;

    if (!data.modes[mode]) data.modes[mode] = [];

    // Если ID уже есть — обновляем, если нет — добавляем
    const index = data.modes[mode].findIndex(l => l.id === newLevel.id);
    if (index !== -1) {
        data.modes[mode][index] = newLevel;
    } else {
        data.modes[mode].push(newLevel);
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// Удаление уровня
app.delete('/crosswordle/api/levels/:mode/:id', (req, res) => {
    const { mode, id } = req.params;
    const filePath = path.join(__dirname, 'levels.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    data.modes[mode] = data.modes[mode].filter(l => l.id != id);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

// Получить список всех уровней (для списка в админке)
app.get('/crosswordle/api/admin/levels', (req, res) => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'levels.json'), 'utf8'));
    res.json(data.modes);
});

app.get('/crosswordle/api/levels/:mode/id/:id', (req, res) => {
    const { mode, id } = req.params;
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'levels.json'), 'utf8'));
    const level = data.modes[mode]?.find(l => String(l.id) === String(id));
    
    if (level) res.json(level);
    else res.status(404).json({ error: "Уровень на этот день еще не создан" });
});

app.listen(3001, () => console.log('Backend запущен на порту 3001'));