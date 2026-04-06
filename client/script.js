let levelData = null;
let currentLetters = [];
let selectedIndex = null;
let moves = 0;
let timerInterval = null;
let seconds = 0;
let isPaused = false;

// 1. Загружаем сохраненный режим из памяти браузера
let currentMode = localStorage.getItem('lastMode') || '7x7';
let isDaily = localStorage.getItem('lastIsDaily') !== 'false';

document.addEventListener('DOMContentLoaded', () => {
    const btnId = isDaily ? `btn-daily-${currentMode}` : `btn-inf-${currentMode}`;
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Проверка кнопки при первой загрузке
    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn) {
        if (isDaily) newGameBtn.classList.add('hidden');
        else newGameBtn.classList.remove('hidden');
    }
    
    initGame();
});

function startTimer() {
    stopTimer();
    const timerElement = document.getElementById('timer');
    if (!timerElement) return;

    timerInterval = setInterval(() => {
        if (!isPaused) {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerElement.textContent = `Время: ${mins}:${secs}`;
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function togglePause() {
    isPaused = !isPaused;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = isPaused ? 'flex' : 'none';
}

async function changeMode(mode, dailyFlag) {
	document.getElementById('result-modal').style.display = 'none';
    currentMode = mode;
    isDaily = dailyFlag;
    localStorage.setItem('lastMode', mode);
    localStorage.setItem('lastIsDaily', dailyFlag);
	
    // Управление кнопкой "Новая игра" в основном интерфейсе
    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn) {
        if (isDaily) {
            newGameBtn.classList.add('hidden');
        } else {
            newGameBtn.classList.remove('hidden');
        }
    }

    selectedIndex = null; 
    await initGame();
}

async function initGame() {
    const statusElem = document.getElementById('status');
    const grid = document.getElementById('grid');
    const dailyId = isDaily ? getDailyTargetId(currentMode) : null;
    
    if (isDaily) {
        if (localStorage.getItem(`played_id_${dailyId}`) === 'true') {
            grid.innerHTML = `
                <div style="text-align:center; padding: 20px; color: #787c7e; grid-column: 1 / -1;">
                    <h3>Вы уже прошли этот режим!</h3>
                    <p>Новый кроссворд появится ежедневно в 12:00 UTC.</p>
                </div>`;
            if (statusElem) statusElem.textContent = '';
            document.getElementById('moves-count').textContent = '0';
            stopTimer();
            document.getElementById('timer').textContent = "Время: 00:00";
            return;
        }
    }

    try {
        if (statusElem) statusElem.textContent = "Загрузка...";
        
        let response;
        if (isDaily) {
            // Пытаемся загрузить ежедневный
            response = await fetch(`http://localhost:3001/api/levels/${currentMode}/id/${dailyId}`);
            
            // Если ежедневный не найден (404), загружаем случайный как запасной вариант
            if (response.status === 404) {
                console.warn(`Пазл ${dailyId} не найден, загружаю случайный...`);
                response = await fetch(`http://localhost:3001/api/levels/${currentMode}/random`);
            }
        } else {
            response = await fetch(`http://localhost:3001/api/levels/${currentMode}/random`);
        }

        if (!response.ok) throw new Error("Ошибка сервера");
        
        levelData = await response.json();
        moves = levelData.maxMoves;
        currentLetters = [...levelData.initialLetters];
        seconds = 0;
        isPaused = false;
        selectedIndex = null;

        if (statusElem) statusElem.textContent = "";

        renderGrid();
        updateUI();
        startTimer();
    } catch (err) {
        console.error("Ошибка:", err);
        if (statusElem) statusElem.textContent = "Ошибка загрузки";
        grid.innerHTML = "";
    }
}

function renderGrid() {
    const grid = document.getElementById('grid');
    if (!grid || !levelData) return;

    grid.innerHTML = '';
    const cols = levelData.gridSize.cols;
    grid.style.gridTemplateColumns = `repeat(${cols}, 60px)`;

    levelData.solution.forEach((cell, index) => {
        const div = document.createElement('div');
        div.className = 'cell';
        div.style.gridRow = cell.r + 1;
        div.style.gridColumn = cell.c + 1;
        div.textContent = currentLetters[index] || "";
        
        div.onclick = () => {
            if (!isPaused) handleSwap(index);
        };
        grid.appendChild(div);
    });

    updateCellColors();
}

function updateCellColors() {
    const cells = document.querySelectorAll('.cell');
    if (!cells.length || !levelData) return;

    const solution = levelData.solution;
    const current = currentLetters;
    const statuses = new Array(current.length).fill('grey');

    current.forEach((char, i) => {
        if (char === solution[i].char) statuses[i] = 'green';
    });

    const getWordIndices = (index) => {
        const cell = solution[index];
        const r = cell.r;
        const c = cell.c;
        const getIdx = (row, col) => solution.findIndex(s => s.r === row && s.c === col);
        const indices = new Set([index]);
        
        let currC = c - 1; while(getIdx(r, currC) !== -1) { indices.add(getIdx(r, currC)); currC--; }
        currC = c + 1; while(getIdx(r, currC) !== -1) { indices.add(getIdx(r, currC)); currC++; }
        let currR = r - 1; while(getIdx(currR, c) !== -1) { indices.add(getIdx(currR, c)); currR--; }
        currR = r + 1; while(getIdx(currR, c) !== -1) { indices.add(getIdx(currR, c)); currR++; }
        
        return Array.from(indices);
    };

    current.forEach((char, i) => {
        if (statuses[i] === 'green') return;

        const wordIndices = getWordIndices(i);
        const targetCount = wordIndices.filter(idx => solution[idx].char === char).length;
        const greenCount = wordIndices.filter(idx => statuses[idx] === 'green' && current[idx] === char).length;
        const yellowCount = wordIndices.filter(idx => statuses[idx] === 'yellow' && current[idx] === char && idx < i).length;

        if (targetCount - greenCount - yellowCount > 0) {
            statuses[i] = 'yellow';
        } else {
            statuses[i] = 'grey';
        }
    });

    cells.forEach((cell, i) => {
        cell.className = `cell ${statuses[i]}`;
        if (selectedIndex === i) cell.classList.add('selected');
    });
}

function handleSwap(idx) {
    if (selectedIndex === null) {
        selectedIndex = idx;
    } else {
        if (selectedIndex !== idx) {
            [currentLetters[selectedIndex], currentLetters[idx]] = [currentLetters[idx], currentLetters[selectedIndex]];
            moves--;
            updateUI();
            checkState();
        }
        selectedIndex = null;
    }
    renderGrid();
}

function updateUI() {
    const counter = document.getElementById('moves-count');
    if (counter) counter.textContent = moves;
}

// 4. Логика Статистики
function updateStats(isWin, stars = 0) {
    let stats = JSON.parse(localStorage.getItem('crosswordle_stats')) || { streak: 0, played: 0, stars: 0 };
    
    if (isWin) {
        stats.played++;
        stats.streak++;
        stats.stars += stars; // Прибавляем полученные звезды к общему счету
    } else {
        // Если игрок просто закрыл или сдался — можно сбросить стрик, 
        // но если нажал "Продолжить", статистика обновится позже при победе.
    }

    localStorage.setItem('crosswordle_stats', JSON.stringify(stats));
    
    document.getElementById('stat-streak').textContent = stats.streak;
    document.getElementById('stat-played').textContent = stats.played;
    document.getElementById('stat-stars').textContent = stats.stars;
}

function checkState() {
    const isWin = levelData.solution.every((s, i) => currentLetters[i] === s.char);
    
    if (isWin) {
        stopTimer();
        // Рассчитываем звезды: максимум 6, минимум 0 (если победил на последнем ходу)
        const starsEarned = Math.max(0, Math.min(6, moves));
        
        if (isDaily) {
            const today = new Date().toLocaleDateString();
            localStorage.setItem(`played_daily_${currentMode}`, today);
        }

        updateStats(true, starsEarned);
        showResultModal(true, starsEarned);
    } 
    else if (moves <= 0) {
        stopTimer();
        // Ходы закончились, но не выиграл — показываем модалку с выбором
        showResultModal(false);
    }
}

function showResultModal(isWin, stars = 0) {
    const modal = document.getElementById('result-modal');
    const title = document.getElementById('modal-title');
    
    // Удаляем старые кнопки действий, если они были
    const oldActions = document.getElementById('modal-actions');
    if (oldActions) oldActions.remove();

    const actionContainer = document.createElement('div');
    actionContainer.id = 'modal-actions';
    actionContainer.style.marginTop = '20px';

    if (isWin) {
        title.textContent = "ПОБЕДА! 🎉";
        const starString = "⭐".repeat(stars) + "✨".repeat(Math.max(0, 6 - stars));
        title.innerHTML += `<div style="font-size: 30px; margin-top: 10px;">${starString}</div>`;
        
        actionContainer.innerHTML = `<button class="btn-main" onclick="nextGame()">ИГРАТЬ ЕЩЕ</button>`;
    } else {
        title.textContent = "ХОДЫ ЗАКОНЧИЛИСЬ! 😟";
        actionContainer.innerHTML = `
            <button class="btn-main" style="background: #6aaa64; margin-bottom: 10px;" onclick="continueGame()">ИГРАТЬ БЕЗ ЛИМИТА ♾️</button>
            <button class="btn-main" style="background: #787c7e; margin-bottom: 10px;" onclick="revealAnswer()">ПОКАЗАТЬ ОТВЕТ 💡</button>
            <button class="btn-main" style="background: #d32f2f;" onclick="nextGame()">НОВАЯ ИГРА 🔄</button>
        `;
    }

    modal.querySelector('.modal-content').appendChild(actionContainer);
    modal.style.display = 'flex';
}

function continueGame() {
    moves = 99; 
    const modal = document.getElementById('result-modal');
    if (modal) modal.style.display = 'none'; // Скрываем окно сразу
    
    updateUI();
    startTimer();
}

function revealAnswer() {
    const modal = document.getElementById('result-modal');
    if (modal) modal.style.display = 'none';

    currentLetters = levelData.solution.map(s => s.char);
    renderGrid(); 
    
    stopTimer();
    moves = 0;
    updateUI();
}

function restartGame() {
    currentLetters = [...levelData.initialLetters];
    moves = levelData.maxMoves;
    seconds = 0;
    isPaused = false;
    if (document.getElementById('pause-overlay')) document.getElementById('pause-overlay').style.display = 'none';
    renderGrid();
    updateUI();
    startTimer();
}

function nextGame() {
    // Скрываем модалку
    document.getElementById('result-modal').style.display = 'none';

    if (isDaily) {
        // Если прошли Daily, предлагаем выбор
        showTransitionMenu();
    } else {
        // Если и так был бесконечный — просто грузим следующий рандомный
        initGame();
    }
}

function giveUp() {
    // Просто вызываем нашу готовую функцию показа ответа
    // Она остановит таймер и покажет решение
    revealAnswer();
}

function getDailyTargetId(size) {
    const now = new Date();
    // Полдень по Гринвичу (UTC)
    if (now.getUTCHours() < 12) {
        now.setUTCDate(now.getUTCDate() - 1);
    }
    
    const d = String(now.getUTCDate()).padStart(2, '0');
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const y = now.getUTCFullYear();
    
    // Важно: берем суффикс из текущего режима (например, "9x9" -> "99")
    const sizeSuffix = size.replace('x', '');
    return `${d}${m}${y}${sizeSuffix}`;
}

function showTransitionMenu() {
    const modal = document.getElementById('result-modal');
    const title = document.getElementById('modal-title');
    
    title.textContent = "ЧТО ДАЛЬШЕ?";
    
    // Очищаем старые кнопки
    const oldActions = document.getElementById('modal-actions');
    if (oldActions) oldActions.remove();

    const actionContainer = document.createElement('div');
    actionContainer.id = 'modal-actions';
    actionContainer.style.marginTop = '20px';

    // Определяем, какой Daily режим сейчас НЕ активен
    const otherDailySize = currentMode === '7x7' ? '9x9' : '7x7';

    actionContainer.innerHTML = `
        <button class="control-btn" style="width: 100%; margin-bottom: 10px; background: #6aaa64; color: white;" 
            onclick="changeMode('${currentMode}', false)">
            БЕСКОНЕЧНЫЙ РЕЖИМ ${currentMode}
        </button>
        <button class="control-btn" style="width: 100%; margin-bottom: 10px;" 
            onclick="changeMode('${otherDailySize}', true)">
            ЕЖЕДНЕВНЫЙ ${otherDailySize}
        </button>
        <button class="control-btn" style="width: 100%;" 
            onclick="location.reload()">
            НА ГЛАВНУЮ
        </button>
    `;

    modal.querySelector('.modal-content').appendChild(actionContainer);
    modal.style.display = 'flex';
}