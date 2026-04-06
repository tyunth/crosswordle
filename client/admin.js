let currentLevelData = null;
let selectedIndex = null;
let isShuffleMode = false;
let shuffleCounter = 0; // Счетчик перестановок
let currentSize = '7x7';

document.addEventListener('DOMContentLoaded', () => {
    resetToEdit();
    loadLevelList();
});

function resetToEdit() {
    currentLevelData = null;
    selectedIndex = null;
    isShuffleMode = false;
    shuffleCounter = 0;
    document.getElementById('btn-shuffle').style.display = "block";
    document.getElementById('btn-save').style.display = "none";
    document.getElementById('admin-status').textContent = "Режим: Заполнение букв";
    
    // ИСПРАВЛЕНИЕ: Берем размер из переменной currentSize, а не из несуществующего select
    const size = parseInt(currentSize.split('x')[0]); 
    
    const grid = document.getElementById('admin-grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${size}, 70px)`;

    for (let i = 0; i < size * size; i++) {
        const div = document.createElement('div');
        div.className = 'cell';
        div.style.background = "#fff";
        
        const input = document.createElement('input');
        input.className = 'edit-input';
        input.maxLength = 1;
        input.dataset.idx = i;
        
        input.onkeydown = (e) => handleArrows(e, i, size);
        
        div.appendChild(input);
        grid.appendChild(div);
    }
}

function handleArrows(e, idx, size) {
    const inputs = document.querySelectorAll('.edit-input');
    let nextIdx = idx;

    if (e.key === "ArrowRight") nextIdx = idx + 1;
    else if (e.key === "ArrowLeft") nextIdx = idx - 1;
    else if (e.key === "ArrowUp") nextIdx = idx - size;
    else if (e.key === "ArrowDown") nextIdx = idx + size;
    else return;

    if (inputs[nextIdx]) {
        e.preventDefault();
        inputs[nextIdx].focus();
    }
}

function prepareShuffle() {
    // ИСПРАВЛЕНИЕ: Получаем число из currentSize (например, из "7x7" берем 7)
    const size = parseInt(currentSize.split('x')[0]);
    
    const inputs = document.querySelectorAll('.edit-input');
    const solution = [];
    const letters = [];

    inputs.forEach((input, index) => {
        if (input.value.trim() !== '') {
            solution.push({ 
                r: Math.floor(index / size), 
                c: index % size, 
                char: input.value.toUpperCase() 
            });
            letters.push(input.value.toUpperCase());
        }
    });

    if (solution.length === 0) return alert("Сначала впиши буквы!");

    currentLevelData = {
        id: document.getElementById('level-id').value || Date.now(), // Берем ID из поля, если ввели
        gridSize: { rows: size, cols: size },
        solution: solution,
        initialLetters: [...letters],
        maxMoves: parseInt(document.getElementById('moves-input').value)
    };

    isShuffleMode = true;
    shuffleCounter = 0;
    renderShuffleGrid();
}

function renderShuffleGrid() {
    const grid = document.getElementById('admin-grid');
    grid.innerHTML = '';
    const size = currentLevelData.gridSize.rows;
    
    // Поддерживаем структуру сетки
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${size}, 70px)`;

    document.getElementById('btn-shuffle').style.display = "none";
    document.getElementById('btn-save').style.display = "block";
    document.getElementById('admin-status').innerHTML = `Перемешивание. Перестановок: <b>${shuffleCounter}</b>`;

    currentLevelData.solution.forEach((cell, index) => {
        const div = document.createElement('div');
        const currentChar = currentLevelData.initialLetters[index];
        const correctChar = cell.char; // Буква, которая ДОЛЖНА тут быть

        // ЛОГИКА ИЗ ПУНКТА 1: Зеленый только если на своем месте
        if (currentChar === correctChar) {
            div.className = 'cell green';
        } else {
            div.className = 'cell grey';
        }

        div.style.width = "70px";
        div.style.height = "70px";
        div.style.gridRow = cell.r + 1;
        div.style.gridColumn = cell.c + 1;
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.justifyContent = "center";
        div.style.fontSize = "32px";
        div.style.fontWeight = "800";
        div.style.color = "white";
        div.textContent = currentChar;

        if (selectedIndex === index) {
            div.style.outline = "4px solid #4a90e2";
            div.style.transform = "scale(1.05)";
        }

        div.onclick = () => {
            if (selectedIndex === null) {
                selectedIndex = index;
            } else {
                if (selectedIndex !== index) {
                    const temp = currentLevelData.initialLetters[selectedIndex];
                    currentLevelData.initialLetters[selectedIndex] = currentLevelData.initialLetters[index];
                    currentLevelData.initialLetters[index] = temp;
                    shuffleCounter++;
                }
                selectedIndex = null;
            }
            renderShuffleGrid();
        };
        grid.appendChild(div);
    });
}





async function saveToServer() {
    const idInput = document.getElementById('level-id').value;
    
    // Если в поле ID пусто — генерируем на основе времени (как запасной вариант)
    // Если не пусто — используем введенный ID
    currentLevelData.id = idInput ? idInput : Date.now();

    try {
        const response = await fetch('http://localhost:3001/api/levels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentLevelData)
        });
        
        if (response.ok) {
            alert("Успешно сохранено с ID: " + currentLevelData.id);
            loadLevelList();
            resetToEdit();
            document.getElementById('level-id').value = ""; // Очищаем после сохранения
        }
    } catch (e) {
        alert("Ошибка сохранения");
    }
}

async function deleteLevel(mode, id) {
    if (!confirm("Точно удалить?")) return;
    await fetch(`http://localhost:3001/api/levels/${mode}/${id}`, { method: 'DELETE' });
    loadLevelList();
}


async function loadLevelList() {
    const res = await fetch('http://localhost:3001/api/admin/levels');
    const modes = await res.json();
    const list = document.getElementById('level-list');
    list.innerHTML = '';

    // ИСПРАВЛЕНИЕ: Используем глобальную переменную currentSize вместо size-select
    const displayMode = currentSize; 

    if (modes[displayMode]) {
        modes[displayMode].forEach(lvl => {
            const div = document.createElement('div');
            div.className = 'level-item';
            div.innerHTML = `
                <span>ID: ${lvl.id} (${lvl.maxMoves} ходов)</span>
                <div>
                    <button onclick='loadForEdit(${JSON.stringify(lvl)})'>✎</button>
                    <button onclick='deleteLevel("${displayMode}", "${lvl.id}")'>✖</button>
                </div>
            `;
            list.appendChild(div);
        });
    } else {
        list.innerHTML = '<div style="color: #888; padding: 10px;">Уровней этого размера нет</div>';
    }
}

function loadForEdit(lvl) {
    resetToEdit();
    currentLevelData = lvl;
    
    const size = lvl.gridSize.rows;
    // Обновляем глобальную переменную, чтобы функции выше знали, какой размер сейчас
    currentSize = `${size}x${size}`;

    // Визуально переключаем кнопки
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-size') === size.toString());
    });

    const grid = document.getElementById('admin-grid');
    grid.style.display = 'grid'; 
    grid.style.gridTemplateColumns = `repeat(${size}, 70px)`;
    grid.style.gap = '12px'; 
    grid.innerHTML = '';

    document.getElementById('moves-input').value = lvl.maxMoves;
    document.getElementById('level-id').value = lvl.id; // Заполняем поле ID данными из уровня

    for (let i = 0; i < size * size; i++) {
        const div = document.createElement('div');
        div.className = 'cell';
        div.style.width = '70px';
        div.style.height = '70px';
        div.style.background = "#fff";
        
        const input = document.createElement('input');
        input.className = 'edit-input';
        input.maxLength = 1;
        input.onkeydown = (e) => handleArrows(e, i, size);
        
        div.appendChild(input);
        grid.appendChild(div);
    }

    const inputs = document.querySelectorAll('.edit-input');
    lvl.solution.forEach((s) => {
        const idx = s.r * size + s.c;
        if(inputs[idx]) inputs[idx].value = s.char;
    });
    
    document.getElementById('admin-status').textContent = "Редактирование: " + lvl.id;
}

async function changeSize(sizeValue) {
    // Обновляем глобальную переменную (например, "7x7")
    currentSize = `${sizeValue}x${sizeValue}`;
    
    // Визуальное переключение активной кнопки
    document.querySelectorAll('.size-btn').forEach(btn => {
        // Проверяем по атрибуту data-size, который мы добавили в HTML
        btn.classList.toggle('active', btn.getAttribute('data-size') === sizeValue.toString());
    });

    resetToEdit();
    loadLevelList(); 
}

function setTodayId() {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    
    // Берем актуальный размер из переменной currentSize
    const sizeSuffix = currentSize.replace('x', ''); 
    document.getElementById('level-id').value = `${d}${m}${y}${sizeSuffix}`;
}