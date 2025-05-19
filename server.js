const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;
const SECRET = "taskhero_2024_secret";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./taskhero.db");

// --- БАЗА ДАННЫХ --- //
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    gold INTEGER DEFAULT 100,
    exp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    bio TEXT DEFAULT '',
    avatar TEXT DEFAULT 'avatars/warrior.png',
    theme TEXT DEFAULT '{"primary":"#4a6fa5","secondary":"#6b8cbe"}',
    achievements TEXT DEFAULT '[]',
    inventory TEXT DEFAULT '{"avatars":["avatars/warrior.png"],"themes":[],"boosts":[]}'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT, -- habit/daily/todo
    name TEXT,
    difficulty TEXT,
    exp INTEGER,
    gold INTEGER,
    counter INTEGER,
    target INTEGER,
    days TEXT,
    due_date TEXT,
    completed INTEGER DEFAULT 0,
    completedToday INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS shop (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    name TEXT,
    price INTEGER,
    image TEXT,
    colors TEXT,
    icon TEXT,
    description TEXT,
    duration INTEGER
  )`);
  // Заполняем магазин при первом запуске
  db.get("SELECT COUNT(*) as cnt FROM shop", (err, row) => {
    if (row.cnt === 0) {
      // Аватарки
      db.run(`INSERT INTO shop (category, name, price, image) VALUES ('avatars','Воин',50,'avatars/warrior.png')`);
      db.run(`INSERT INTO shop (category, name, price, image) VALUES ('avatars','Маг',75,'avatars/mag.png')`);
      db.run(`INSERT INTO shop (category, name, price, image) VALUES ('avatars','Лучник',100,'avatars/luch.png')`);
      db.run(`INSERT INTO shop (category, name, price, image) VALUES ('avatars','Дракон',150,'avatars/dragon.png')`);
      db.run(`INSERT INTO shop (category, name, price, image) VALUES ('avatars','Феникс',200,'avatars/phoenix.png')`);
      db.run(`INSERT INTO shop (category, name, price, image) VALUES ('avatars','Самурай',250,'avatars/samurai.png')`);
      db.run(`INSERT INTO shop (category, name, price, image) VALUES ('avatars','Рыцарь',300,'avatars/ricar.png')`);
      db.run(`INSERT INTO shop (category, name, price, image) VALUES ('avatars','Ведьма',350,'avatars/witcher.png')`);
      db.run(`INSERT INTO shop (category, name, price, image) VALUES ('avatars','Ниндзя',400,'avatars/ninja.png')`);
      // Темы
      db.run(`INSERT INTO shop (category,name,price,colors) VALUES ('themes','Лесная',100,'{"primary":"#2E7D32","secondary":"#81C784"}')`);
      db.run(`INSERT INTO shop (category,name,price,colors) VALUES ('themes','Океан',150,'{"primary":"#0288D1","secondary":"#4FC3F7"}')`);
      db.run(`INSERT INTO shop (category,name,price,colors) VALUES ('themes','Песочная',120,'{"primary":"#F57F17","secondary":"#FFD54F"}')`);
      db.run(`INSERT INTO shop (category,name,price,colors) VALUES ('themes','Темная',200,'{"primary":"#424242","secondary":"#9E9E9E"}')`);
      db.run(`INSERT INTO shop (category,name,price,colors) VALUES ('themes','Розовая',180,'{"primary":"#E91E63","secondary":"#F8BBD0"}')`);
      db.run(`INSERT INTO shop (category,name,price,colors) VALUES ('themes','Фиолетовая',220,'{"primary":"#7B1FA2","secondary":"#BA68C8"}')`);
      // Бусты
      db.run(`INSERT INTO shop (category,name,price,icon,description,duration) VALUES ('boosts','2x Опыт',300,'fa-bolt','Удваивает опыт на 24 ч',24)`);
      db.run(`INSERT INTO shop (category,name,price,icon,description,duration) VALUES ('boosts','2x Золото',250,'fa-coins','Удваивает золото на 24 ч',24)`);
      db.run(`INSERT INTO shop (category,name,price,icon,description,duration) VALUES ('boosts','Иммунитет',400,'fa-shield-alt','Защита от потерь на 48 ч',48)`);
      db.run(`INSERT INTO shop (category,name,price,icon,description,duration) VALUES ('boosts','Энергия',350,'fa-battery-full','Ускоряет задачи на 12 ч',12)`);
      db.run(`INSERT INTO shop (category,name,price,icon,description,duration) VALUES ('boosts','Удача',500,'fa-clover','Больше редких предметов на 36 ч',36)`);
    }
  });
  // Админ
  db.get("SELECT * FROM users WHERE username='admin'", (e, r) => {
    if (!r) {
      bcrypt.hash("admin", 10, (err, hash) => {
        db.run(
          `INSERT INTO users (username,password,gold,exp,level,avatar,theme,inventory) VALUES (?,?,?,?,?,?,?,?)`,
          [
            'admin',
            hash,
            1000,
            0,
            1,
            'avatars/warrior.png',
            '{"primary":"#4a6fa5","secondary":"#6b8cbe"}',
            '{"avatars":["avatars/warrior.png"],"themes":[],"boosts":[]}'
          ]
        );
      });
    }
  });
});

// --- МИДЛВАРЫ ---
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Требуется авторизация" });
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Ошибка токена" });
    req.user = user;
    next();
  });
}

// --- АВТОРИЗАЦИЯ ---
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Логин и пароль обязательны" });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: "Ошибка сервера" });
    db.run(
      `INSERT INTO users (username,password,inventory,avatar) VALUES (?,?,?,?)`,
      [
        username,
        hash,
        '{"avatars":["avatars/warrior.png"],"themes":[],"boosts":[]}',
        'avatars/warrior.png'
      ],
      function (err) {
        if (err)
          return res.status(400).json({ error: "Пользователь уже существует" });
        const token = jwt.sign(
          { id: this.lastID, username, role: "user" },
          SECRET
        );
        res.json({ token, username });
      }
    );
  });
});

// --- ЛОГИН ---
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username=?", [username], (err, user) => {
    if (!user)
      return res.status(400).json({ error: "Неверный логин или пароль" });
    bcrypt.compare(password, user.password, (err, ok) => {
      if (!ok)
        return res.status(400).json({ error: "Неверный логин или пароль" });
      const token = jwt.sign(
        { id: user.id, username: user.username, role: "user" },
        SECRET
      );
      res.json({ token, username });
    });
  });
});

// --- ПОЛУЧЕНИЕ ПРОФИЛЯ ---
app.get("/api/me", auth, (req, res) => {
  db.get(
    "SELECT username,gold,exp,level,bio,avatar,theme,achievements,inventory FROM users WHERE id=?",
    [req.user.id],
    (e, u) => {
      if (!u) return res.status(404).json({ error: "Пользователь не найден" });
      u.theme = JSON.parse(u.theme || '{"primary":"#4a6fa5","secondary":"#6b8cbe"}');
      u.achievements = JSON.parse(u.achievements || "[]");
      u.inventory = JSON.parse(u.inventory || '{"avatars":["avatars/warrior.png"],"themes":[],"boosts":[]}');
      res.json(u);
    }
  );
});

// --- ОБНОВЛЕНИЕ ПРОФИЛЯ ---
app.post("/api/profile", auth, (req, res) => {
  const { bio, avatar, theme } = req.body;
  let q = [], params = [];
  if (bio !== undefined) { q.push("bio=?"); params.push(bio); }
  if (avatar !== undefined) { q.push("avatar=?"); params.push(avatar); }
  if (theme !== undefined) { q.push("theme=?"); params.push(JSON.stringify(theme)); }
  if (!q.length) return res.json({ success: true });
  params.push(req.user.id);
  db.run(`UPDATE users SET ${q.join(",")} WHERE id=?`, params, err => res.json({ success: true }));
});

// --- ЗАДАЧИ --- //
app.get("/api/tasks", auth, (req, res) => {
  db.all("SELECT * FROM tasks WHERE user_id=?", [req.user.id], (e, rows) => {
    res.json(rows || []);
  });
});

app.post("/api/tasks", auth, (req, res) => {
  const t = req.body;
  db.run(
    `INSERT INTO tasks 
      (user_id,type,name,difficulty,exp,gold,counter,target,days,due_date,completed,completedToday)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,0)`,
    [
      req.user.id,
      t.type,
      t.name,
      t.difficulty,
      t.exp,
      t.gold,
      t.counter || 0,
      t.target || 1,
      t.days ? JSON.stringify(t.days) : null,
      t.dueDate || null
    ],
    function (err) {
      if (err) return res.status(400).json({ error: "Ошибка добавления задачи" });
      res.json({ id: this.lastID });
    }
  );
});

app.put("/api/tasks/:id", auth, (req, res) => {
  const t = req.body, id = req.params.id;
  db.get("SELECT * FROM tasks WHERE id=? AND user_id=?", [id, req.user.id], (e, old) => {
    if (!old) return res.status(404).json({ error: "Нет задачи" });
    db.run(
      `UPDATE tasks SET name=?, difficulty=?, exp=?, gold=?, counter=?, target=?, days=?, due_date=? WHERE id=?`,
      [
        t.name,
        t.difficulty,
        t.exp,
        t.gold,
        t.counter || 0,
        t.target || 1,
        t.days ? JSON.stringify(t.days) : null,
        t.dueDate || null,
        id
      ],
      err => {
        if (err) return res.status(400).json({ error: "Ошибка обновления задачи" });
        res.json({ success: true });
      }
    );
  });
});

app.delete("/api/tasks/:id", auth, (req, res) => {
  db.run("DELETE FROM tasks WHERE id=? AND user_id=?", [req.params.id, req.user.id], err => res.json({ success: true }));
});

app.post("/api/tasks/:id/complete", auth, (req, res) => {
  db.get("SELECT * FROM tasks WHERE id=? AND user_id=?", [req.params.id, req.user.id], (e, task) => {
    if (!task) return res.status(404).json({ error: "Нет задачи" });
    // Для привычек — инкрементируем counter
    if (task.type === 'habit') {
      let counter = (task.counter || 0) + 1;
      if (counter >= (task.target || 1)) counter = 0;
      db.run("UPDATE tasks SET counter=? WHERE id=?", [counter, task.id]);
    }
    // Для других — completed=1
    else {
      db.run("UPDATE tasks SET completed=1 WHERE id=?", [task.id]);
    }
    // Награды пользователю
    db.get("SELECT * FROM users WHERE id=?", [req.user.id], (e, user) => {
      let gold = user.gold + task.gold;
      let exp = user.exp + task.exp;
      let level = user.level, expMax = 50 * Math.pow(1.5, user.level - 1);
      if (exp >= expMax) { level++; exp -= expMax; }
      db.run("UPDATE users SET gold=?, exp=?, level=? WHERE id=?", [gold, exp, level, user.id]);
      res.json({ success: true });
    });
  });
});

// --- МАГАЗИН ---
app.get("/api/shop", auth, (req, res) => {
  db.all("SELECT * FROM shop", [], (e, items) => {
    db.get("SELECT inventory FROM users WHERE id=?", [req.user.id], (ee, userInv) => {
      let inventory = JSON.parse(userInv.inventory || '{"avatars":[],"themes":[],"boosts":[]}');
      items = items.map(i => {
        i.owned = false;
        if (i.category === "avatars" && inventory.avatars.includes(i.image)) i.owned = true;
        if (i.category === "themes" && inventory.themes.includes(i.colors)) i.owned = true;
        if (i.category === "boosts" && inventory.boosts.includes(i.name)) i.owned = true;
        return i;
      });
      res.json(items);
    });
  });
});

app.post("/api/shop/buy", auth, (req, res) => {
  const { category, id } = req.body;
  db.get("SELECT * FROM shop WHERE id=?", [id], (e, item) => {
    if (!item) return res.status(404).json({ error: "Не найдено" });
    db.get("SELECT * FROM users WHERE id=?", [req.user.id], (e, user) => {
      let inventory = JSON.parse(user.inventory || '{"avatars":[],"themes":[],"boosts":[]}');
      if (item.category === "avatars" && inventory.avatars.includes(item.image)) return res.json({ error: "Уже куплено" });
      if (item.category === "themes" && inventory.themes.includes(item.colors)) return res.json({ error: "Уже куплено" });
      if (item.category === "boosts" && inventory.boosts.includes(item.name)) return res.json({ error: "Уже куплено" });
      if (user.gold < item.price) return res.json({ error: "Недостаточно золота" });

      // Добавляем в инвентарь
      if (item.category === "avatars") inventory.avatars.push(item.image);
      if (item.category === "themes") inventory.themes.push(item.colors);
      if (item.category === "boosts") inventory.boosts.push(item.name);

      db.run("UPDATE users SET gold=gold-?, inventory=? WHERE id=?", [item.price, JSON.stringify(inventory), req.user.id], err => {
        res.json({ success: true, avatar: item.image, theme: item.colors });
      });
    });
  });
});

// --- СТАТИКА --- //
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`TaskHero server started: http://localhost:${PORT}`);
});
