// TaskHero - Frontend logic (авторизация, профиль, задачи, магазин, привычки)

let user = null, token = null;
let shopCache = { avatars:[], themes:[], boosts:[] }, tasksCache = [];

document.addEventListener('DOMContentLoaded', function() {
  // --- Авторизация ---
  token = localStorage.getItem('token');
  if (!token) return showAuth();
  fetchProfile().then(u => {
    user = u;
    showMainApp();
  }).catch(showAuth);

  // --- Авторизация: форма входа/регистрации ---
  document.getElementById('switchToReg').onclick = () => switchAuthMode('reg');
  document.getElementById('switchToLogin').onclick = () => switchAuthMode('login');
  document.getElementById('authForm').onsubmit = async function(e) {
    e.preventDefault();
    const login = document.getElementById('authLogin').value.trim();
    const pass = document.getElementById('authPassword').value.trim();
    const isReg = document.getElementById('authBtn').textContent === 'Зарегистрироваться';
    const url = isReg ? '/api/register' : '/api/login';
    const resp = await fetch(url, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:login,password:pass})
    });
    const data = await resp.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      token = data.token;
      user = await fetchProfile();
      showMainApp();
    } else {
      document.getElementById('auth-error').textContent = data.error || 'Ошибка';
    }
  };

  // --- Выйти ---
  document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem('token');
    location.reload();
  };
});

// --- Авторизация: показать форму ---
function showAuth() {
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('auth-block').style.display = '';
}

// --- Авторизация: переключение форм ---
function switchAuthMode(mode) {
  if (mode === 'reg') {
    document.getElementById('auth-title').textContent = 'Регистрация';
    document.getElementById('authBtn').textContent = 'Зарегистрироваться';
    document.getElementById('switchToReg').style.display = 'none';
    document.getElementById('switchToLogin').style.display = '';
  } else {
    document.getElementById('auth-title').textContent = 'Вход';
    document.getElementById('authBtn').textContent = 'Войти';
    document.getElementById('switchToReg').style.display = '';
    document.getElementById('switchToLogin').style.display = 'none';
  }
  document.getElementById('auth-error').textContent = '';
}

// --- Получить профиль пользователя ---
async function fetchProfile() {
  const res = await fetch('/api/me', {headers:{Authorization:'Bearer '+localStorage.getItem('token')}});
  if (!res.ok) throw new Error('not auth');
  return await res.json();
}

// --- Показать основное приложение ---
async function showMainApp() {
  document.getElementById('auth-block').style.display = 'none';
  document.getElementById('mainApp').style.display = '';
  document.getElementById('logoutBtn').style.display = '';
  await refreshProfileUI();
  await loadShop();
  await loadTasks();
  initTabs();
  initProfileModal();
  initShop();
  initTaskModal();
  initSubTabs();
}

// --- UI профиля (аватар, опыт, золото, уровень, тема, био) ---
async function refreshProfileUI() {
  user = await fetchProfile();
  document.getElementById('profile-avatar').src = user.avatar;
  document.getElementById('headerAvatar').src = user.avatar;
  document.getElementById('profile-level').textContent = user.level;
  document.getElementById('gold-value').textContent = user.gold;
  document.getElementById('shop-gold-amount').textContent = user.gold;
  document.getElementById('exp-value').textContent = user.exp;
  let expMax = Math.floor(50 * Math.pow(1.5, user.level - 1));
  document.getElementById('exp-max').textContent = expMax;
  document.getElementById('exp-bar').style.width = `${Math.min(100, Math.round(user.exp/expMax*100))}%`;
  document.getElementById('profile-bio').value = user.bio || '';
  // Применить тему
  if (user.theme) {
    document.documentElement.style.setProperty('--primary-color', user.theme.primary);
    document.documentElement.style.setProperty('--secondary-color', user.theme.secondary);
  }
  // Достижения
  renderAchievements(user.achievements || []);
  // Инвентарь
  renderInventory(user.inventory || {});
}

// --- Достижения ---
function renderAchievements(achievements) {
  const list = document.getElementById('achievements-list');
  const all = [
    {key:'first', icon:'fa-trophy', name:'Новичок', desc:'Выполните первую задачу'},
    {key:'tough', icon:'fa-medal', name:'Трудяга', desc:'Выполните 10 задач'},
    {key:'master', icon:'fa-crown', name:'Мастер продуктивности', desc:'Выполните 50 задач'},
    {key:'rich', icon:'fa-gem', name:'Богач', desc:'Заработайте 1000 золота'},
  ];
  list.innerHTML = all.map(a => `
    <div class="achievement ${achievements.includes(a.key)?'unlocked':'locked'}">
      <div class="achievement-icon"><i class="fas ${a.icon}"></i></div>
      <div class="achievement-info">
        <h3>${a.name}</h3>
        <p>${a.desc}</p>
        <span class="achievement-date">${achievements.includes(a.key)?'Получено':'Не получено'}</span>
      </div>
    </div>
  `).join('');
}

// --- Инвентарь ---
function renderInventory(inv) {
  // Аватарки
  const avatars = inv.avatars || [];
  let grid = document.querySelector('#avatars-inventory .inventory-grid');
  grid.innerHTML = avatars.length ? avatars.map(img => `
    <div class="inventory-item">
      <img src="${img}" class="inventory-avatar"><h4></h4>
      <button class="use-item-btn" onclick="setAvatar('${img}')">Выбрать</button>
    </div>
  `).join('') : '<p class="empty-inventory">У вас пока нет аватарок</p>';
  // Темы
  const themes = inv.themes || [];
  grid = document.querySelector('#themes-inventory .inventory-grid');
  grid.innerHTML = themes.length ? themes.map(col => {
    let colors = typeof col === 'string' ? JSON.parse(col) : col;
    return `
    <div class="inventory-item">
      <div class="inventory-theme" style="background: linear-gradient(to right, ${colors.primary} 50%, ${colors.secondary} 50%);"></div>
      <h4></h4>
      <button class="use-item-btn" onclick='applyTheme(${JSON.stringify(colors)})'>Применить</button>
    </div>
    `;
  }).join('') : '<p class="empty-inventory">У вас пока нет тем</p>';
}

// --- Выбрать аватарку ---
function setAvatar(url) {
  fetch('/api/profile', {
    method: 'POST',
    headers: {
      ...authHead(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ avatar: url }) // или { theme: colors } или { bio }
  });
  
}
// --- Применить тему ---
function applyTheme(colors) {
  fetch('/api/profile', {
    method: 'POST',
    headers: {
      ...authHead(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ theme: colors }) // или { theme: colors } или { bio }
  });
  
}

// --- Иницилизация вкладок, модалок, под-вкладок ---
function initTabs() {
  document.querySelectorAll('.task-nav li').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.task-nav li').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      // Спец: привычки только 1 подтаб
      if(tabId==='habits') document.querySelector('#habits .sub-tabs').style.display = 'none';
      else document.querySelector(`#${tabId} .sub-tabs`).style.display = '';
      // Сбрасываем подтаб
      let first = document.querySelector(`#${tabId} .sub-tab`);
      if(first) first.click();
      renderAllTasks();
    });
  });
  document.querySelector('.task-nav li.active').click();
}
function initSubTabs() {
  document.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const parentTab = this.closest('.tab-content').id;
      document.querySelectorAll(`#${parentTab} .sub-tab`).forEach(t => t.classList.remove('active'));
      document.querySelectorAll(`#${parentTab} .sub-tab-content`).forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById(this.getAttribute('data-subtab')).classList.add('active');
      renderAllTasks();
    });
  });
}
function initProfileModal() {
  const btn = document.getElementById('profileBtn');
  const modal = document.getElementById('profileModal');
  const closeBtn = document.getElementById('closeProfileModal');
  btn.onclick = () => modal.classList.add('active');
  closeBtn.onclick = () => modal.classList.remove('active');
  window.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.remove('active');
  });
  // Переключение вкладок профиля
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
  // Сохранить био
  document.getElementById('save-bio').onclick = () => {
    const bio = document.getElementById('profile-bio').value;
    fetch('/api/profile', {
      method: 'POST',
      headers: {
        ...authHead(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bio }) // или { theme: colors } или { bio }
    }).then(() => refreshProfileUI());
  };
}

// --- Модалка задачи ---
function initTaskModal() {
  const modal = document.getElementById('taskModal');
  const closeBtn = document.querySelector('#taskModal .close-btn');
  closeBtn.onclick = ()=>modal.classList.remove('active');
  window.addEventListener('click', function(e) { if(e.target===modal) modal.classList.remove('active'); });
  // Открытие для добавления
  document.querySelectorAll('.add-task-btn').forEach(btn => {
    btn.onclick = function() {
      const tab = document.querySelector('.task-nav li.active').getAttribute('data-tab');
      openTaskForm({type:tab.slice(0,-1)}, 'add');
    };
  });
  // Отправка формы
  document.getElementById('taskForm').onsubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const name = document.getElementById('taskName').value;
    const difficulty = document.getElementById('taskDifficulty').value;
    const type = document.getElementById('taskType').value;
    const counterTarget = document.getElementById('counterTarget') ? parseInt(document.getElementById('counterTarget').value) : 1;
    let exp = getReward(difficulty), gold = Math.floor(exp/2);
    let days = null, dueDate = null;
    if(type==='daily') days = Array.from(document.querySelectorAll('.day-selector.active')).map(d=>d.getAttribute('data-day'));
    if(type==='todo') dueDate = document.getElementById('dueDate').value;
    let task = {name,difficulty,type,exp,gold};
    if(type==='habit') { task.target = counterTarget; task.counter = 0; }
    if(days) task.days = days;
    if(dueDate) task.dueDate = dueDate;
    if(id) { // edit
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          ...authHead(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
      });
    } else {
      await fetch(`/api/tasks`, {
        method: 'POST',
        headers: {
          ...authHead(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
      });
    }
    document.getElementById('taskModal').classList.remove('active');
    await loadTasks();
    renderAllTasks();
  };
  // Удалить
  document.getElementById('deleteTaskBtn').onclick = async function() {
    const id = document.getElementById('taskId').value;
    if(id && confirm('Удалить задачу?')) {
      await fetch(`/api/tasks/${id}`,{method:'DELETE',headers:authHead()});
      document.getElementById('taskModal').classList.remove('active');
      await loadTasks(); renderAllTasks();
    }
  };
  // Дни для daily
  document.querySelectorAll('.day-selector').forEach(day => {
    day.onclick = function() { this.classList.toggle('active'); };
  });
}
function openTaskForm(task, mode) {
  const modal = document.getElementById('taskModal');
  document.getElementById('taskForm').reset();
  document.getElementById('taskId').value = task.id||'';
  document.getElementById('taskName').value = task.name||'';
  document.getElementById('taskType').value = task.type||'habit';
  document.getElementById('taskDifficulty').value = task.difficulty||'easy';
  document.getElementById('counterTarget').value = task.target||1;
  document.getElementById('dueDate').value = task.dueDate||'';
  document.getElementById('deleteTaskBtn').style.display = mode==='edit'?'':'none';
  // Поля
  document.getElementById('counterGroup').style.display = task.type==='habit'?'block':'none';
  document.getElementById('daysGroup').style.display = task.type==='daily'?'block':'none';
  document.getElementById('dueDateGroup').style.display = task.type==='todo'?'block':'none';
  // Дни
  if(task.type==='daily' && task.days) {
    document.querySelectorAll('.day-selector').forEach(day => {
      day.classList.toggle('active', task.days.includes(day.getAttribute('data-day')));
    });
  } else {
    document.querySelectorAll('.day-selector').forEach(day => day.classList.remove('active'));
  }
  document.getElementById('modalTitle').textContent = mode==='edit' ? 'Редактировать задачу' : 'Добавить задачу';
  modal.classList.add('active');
}

// --- ЗАДАЧИ: загрузка, отображение, логика ---
// (tasksCache: массив объектов [{...}])
async function loadTasks() {
  const res = await fetch('/api/tasks', {headers:authHead()});
  tasksCache = await res.json();
  renderAllTasks();
}
function renderAllTasks() {
  renderTasks('habits','active');
  renderTasks('dailies','active');
  renderTasks('dailies','completed');
  renderTasks('todos','active');
  renderTasks('todos','completed');
}
function renderTasks(type, status) {
  let container = document.querySelector(`#${type} #${type}-${status} .task-list`);
  if (!container) return;
  container.innerHTML = '';
  let tasks = tasksCache.filter(t => t.type===type.slice(0,-1));
  if(type==='dailies' || type==='todos') {
    tasks = status==='active' ? tasks.filter(t=>!t.completed) : tasks.filter(t=>t.completed);
  }
  if(type==='habits') { // только активные
    tasks = tasks.filter(()=>true); // все
  }
  tasks.forEach(t => {
    const div = document.createElement('div');
    div.className = `task-item ${type.slice(0,-1)} ${t.completed?'completed':''}`;
    div.dataset.id = t.id;
    let html = '';
    // Привычки
    if(type==='habits') {
      html = `
        <div class="task-controls">
            <button class="plus-btn"><i class="fas fa-plus"></i></button>
            <button class="minus-btn"><i class="fas fa-minus"></i></button>
        </div>
        <div class="task-info">
            <h3>${t.name}</h3>
            <p>+${t.exp} опыта, +${t.gold} золота</p>
            <div class="habit-counter">
                <span>${t.counter||0}/${t.target||1}</span>
            </div>
        </div>
        <div class="task-stats">
            <span class="difficulty ${t.difficulty}">${getDifficultyText(t.difficulty)}</span>
        </div>
      `;
    }
    // Ежедневки
    else if(type==='dailies') {
      html = `
        <div class="task-controls">
            <button class="check-btn"><i class="far ${t.completed ? 'fa-check-square' : 'fa-square'}"></i></button>
        </div>
        <div class="task-info">
            <h3>${t.name}</h3>
            <p>+${t.exp} опыта, +${t.gold} золота</p>
            <div class="task-days">
                ${['mon','tue','wed','thu','fri','sat','sun'].map(day => {
                  const isActive = t.days && JSON.parse(t.days).includes(day);
                  const dayNames = { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' };
                  return `<span class="day ${isActive ? 'active' : ''}">${dayNames[day]}</span>`;
                }).join('')}
            </div>
        </div>
        <div class="task-stats">
            <span class="difficulty ${t.difficulty}">${getDifficultyText(t.difficulty)}</span>
        </div>
      `;
    }
    // Задачи
    else if(type==='todos') {
      html = `
        <div class="task-controls">
            <button class="check-btn"><i class="far ${t.completed ? 'fa-check-square' : 'fa-square'}"></i></button>
        </div>
        <div class="task-info">
            <h3>${t.name}</h3>
            <p>+${t.exp} опыта, +${t.gold} золота</p>
            ${t.due_date ? `<div class="task-due">Срок: ${formatDate(t.due_date)}</div>` : ''}
        </div>
        <div class="task-stats">
            <span class="difficulty ${t.difficulty}">${getDifficultyText(t.difficulty)}</span>
        </div>
      `;
    }
    div.innerHTML = html;
    // События
    // Редактировать (по клику на карточку, кроме кнопок)
    div.addEventListener('click', function(e) {
      if (e.target.closest('button') || e.target.tagName === 'I') return;
      openTaskForm(t, 'edit');
    });
    // Плюс/минус/чек
    let plusBtn = div.querySelector('.plus-btn'), minusBtn = div.querySelector('.minus-btn'), checkBtn = div.querySelector('.check-btn');
    if(plusBtn) plusBtn.onclick = async e => { e.stopPropagation(); await completeTask(t.id, 'plus'); };
    if(minusBtn) minusBtn.onclick = async e => { e.stopPropagation(); await minusHabit(t.id); };
    if(checkBtn) checkBtn.onclick = async e => { e.stopPropagation(); await completeTask(t.id, 'check'); };
    container.appendChild(div);
  });
}
// Выполнение задачи
async function completeTask(id, action) {
  await fetch(`/api/tasks/${id}/complete`,{method:'POST',headers:authHead()});
  await loadTasks(); await refreshProfileUI();
}
// Минус привычки (отдельно)
async function minusHabit(id) {
  let t = tasksCache.find(t=>t.id==id);
  t.counter = Math.max(0, (t.counter||0)-1);
  await fetch(`/api/tasks/${id}`,{method:'PUT',headers:authHead(),'Content-Type':'application/json',body:JSON.stringify(t)});
  await loadTasks();
}
// --- Магазин ---
async function loadShop() {
  const res = await fetch('/api/shop',{headers:authHead()});
  let items = await res.json();
  shopCache.avatars = items.filter(i=>i.category==='avatars');
  shopCache.themes = items.filter(i=>i.category==='themes');
  shopCache.boosts = items.filter(i=>i.category==='boosts');
}
// --- Отрисовать магазин ---
function initShop() {
  document.querySelectorAll('.shop-category').forEach(tab => {
    tab.onclick = function() {
      document.querySelectorAll('.shop-category').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      renderShopItems(this.getAttribute('data-category'));
    };
  });
  renderShopItems('avatars');
}
// Отрисовать товары
function renderShopItems(category) {
  let container = document.querySelector('.shop-items-container');
  let items = shopCache[category]||[];
  container.innerHTML = '';
  items.forEach(item => {
    let html = '';
    if(category==='avatars') {
      html = `
        <img src="${item.image}" alt="${item.name}" class="shop-item-avatar">
        <h4 class="shop-item-name">${item.name}</h4>
        <div class="shop-item-price"><i class="fas fa-coins"></i> ${item.price}</div>
        ${item.owned ? '<div class="shop-item-owned"><i class="fas fa-check"></i> Куплено</div>' :
        '<button class="shop-item-button">Купить</button>'}
      `;
    } else if(category==='themes') {
      let col = JSON.parse(item.colors);
      html = `
        <div class="shop-item-theme" style="background: linear-gradient(to bottom, ${col.primary}, ${col.secondary});"></div>
        <h4 class="shop-item-name">${item.name}</h4>
        <div class="shop-item-price"><i class="fas fa-coins"></i> ${item.price}</div>
        ${item.owned ? '<div class="shop-item-owned"><i class="fas fa-check"></i> Куплено</div>' :
        '<button class="shop-item-button">Купить</button>'}
      `;
    } else if(category==='boosts') {
      html = `
        <i class="fas ${item.icon}" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 10px;"></i>
        <h4 class="shop-item-name">${item.name}</h4>
        <p style="font-size: 0.8rem; margin-bottom: 5px;">${item.description}</p>
        <small style="display: block; margin-bottom: 10px;">Длительность: ${item.duration} ч</small>
        <div class="shop-item-price"><i class="fas fa-coins"></i> ${item.price}</div>
        ${item.owned ? '<div class="shop-item-owned"><i class="fas fa-check"></i> Куплено</div>' :
        '<button class="shop-item-button">Купить</button>'}
      `;
    }
    let div = document.createElement('div');
    div.className = `shop-item ${category.slice(0,-1)}`;
    div.innerHTML = html;
    if(!item.owned) {
      let btn = div.querySelector('.shop-item-button');
      btn.onclick = async e => {
        e.stopPropagation();
        const resp = await fetch('/api/shop/buy', {
          method: 'POST',
          headers: {
            ...authHead(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({category, id: item.id})
        });
        const data = await resp.json();
        if(data.success) {
          await refreshProfileUI();
          await loadShop();
          renderShopItems(category);
          alert('Покупка успешна!');
        } else {
          alert(data.error || 'Ошибка покупки');
        }
      };
    }
    container.appendChild(div);
  });
}

// --- ВСПОМОГАТЕЛЬНЫЕ ---
function getReward(difficulty) {
  return difficulty==='easy'?5 : difficulty==='medium'?10 : 20;
}
function getDifficultyText(diff) {
  return diff==='easy'?'Легко':diff==='medium'?'Средне':'Сложно';
}
function formatDate(str) {
  if(!str) return '';
  let d = new Date(str); return d.toLocaleDateString('ru-RU');
}
function authHead() { return {Authorization:'Bearer '+localStorage.getItem('token')}; }