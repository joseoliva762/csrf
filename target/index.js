const express = require('express');
const handlebars = require('express-handlebars');
const session = require('express-session');
const { v4: uuid } = require('uuid');
const fs = require('fs')
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(session({
    secret: 'test',
    resave: false,
    saveUninitialized: false
}));
app.use(express.urlencoded({ extended: true }));
app.use(login);
// app.use(csrf);
app.set('views', __dirname);
app.engine('hbs', handlebars({
    defaultLayout: 'main',
    layoutsDir: __dirname,
    extname: ".hbs"
}));
app.set('view engine', 'hbs');

// Login
function login(req, res, next) {
    if (req.path === "/login") return next();
    if (!req.session.userId) return res.redirect('/login');
    next();
}

// CSRF token
const tokens = new Map();

const CSRFToken = sessionId => {
    const token = uuid();
    tokens.get(sessionId).add(token);
    const timeout = setTimeout(() => {
        tokens.get(sessionId).delete(token);
        clearTimeout(timeout);
    }, 30000);
    return token;
}

function csrf(req, res, next) {
    const token = req.body.csrf;
    if (!token || !tokens.get(req.sessionID).has(token)) return res.status(422).json({ err: 'CSRF token missing or expired' });
    next();
}

// DB
const users = JSON.parse(fs.readFileSync('db.json'));

// Routes
app.get('/home', (req, res) => res.send('Home'));

app.get('/login',  (req, res) => res.render('login'));
app.post('/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
        return res.status(400).json({ err: "Missing data" });
    }
    const user = users.find(user => user.email === email);
    if (!user || user.password !== password) {
        return res.status(400).json({ err: "Invalid credentials" });
    }
    req.session.userId = user.id;

    // mapa vacio de tokens en la sesion
    tokens.set(req.sessionID, new Set());
    res.redirect('/home');
});

app.get('/edit',   (req, res) => {
    res.render('edit', { token: CSRFToken(req.sessionID) });
});
app.post('/edit', csrf,  (req, res) => {
    const user = users.find(user => user.id === req.session.userId);
    user.email = req.body.email;
    let message = `User ${user.id} email changed to ${user.email}`;
    console.log(message);
    res.status(201).json({ message });
});
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
})


// Server
app.listen(port, () => {
    console.log("Listening on port", port);
});