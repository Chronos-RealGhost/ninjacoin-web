const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

// --- GESTÃO DE CAMINHOS NINJA ---
const projectRoot = __dirname.split(path.sep + 'dist')[0].split(path.sep + 'node_modules')[0];

let paths = {
    data: projectRoot,
    bin: path.join(projectRoot, 'bin')
};

if (__dirname.includes('app.asar')) {
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
    paths.data = portableDir || path.dirname(process.execPath);
    paths.bin = path.join(process.resourcesPath, 'bin');
}

// --- CONFIGURAÇÃO DO BANCO DE DADOS ---
const MONGODB_URI = 'mongodb+srv://marcosninja402_db_user:APn6XJQAxHyAik9U@cluster0.nypiqjl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('\n\x1b[32m[SISTEMA NINJA] BANCO DE DADOS CONECTADO NA NUVEM! 🌩️\x1b[0m'))
    .catch(err => console.error('\x1b[31m[ERRO] Falha ao conectar ao MongoDB:\x1b[0m', err.message));

// Esquema de Licenças
const KeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    usedBy: { type: String, default: null },
    createdAt: { type: Number, default: Date.now },
    expiresAt: { type: Number, default: null },
    registeredIP: { type: String, default: null }
});
const Key = mongoose.model('Key', KeySchema);

// Esquema de Usuários
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    key: { type: String, required: true },
    createdAt: { type: Number, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const app = express();
const cors = require('cors');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let minerProcess = null;
let logs = [];
let maxLogs = 100;


// --- ROTAS DE AUTENTICAÇÃO ---

// Registro de Usuário (com verificação de CHAVE)
app.post('/api/auth/register', async (req, res) => {
    const { username, password, key } = req.body;
    if (!username || !password || !key) return res.status(400).json({ error: 'Campos necessários.' });

    try {
        const check = await validateKey(key, getClientIP(req));
        if (!check.valid) return res.status(403).json({ error: 'Licença inválida: ' + check.reason });

        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: 'Usuário já existe.' });

        const keyUsed = await User.findOne({ key: key.trim().toUpperCase() });
        if (keyUsed) return res.status(400).json({ error: 'Licença já vinculada a outra conta.' });

        const newUser = new User({
            username,
            password: hashPassword(password),
            key: key.trim().toUpperCase()
        });

        await newUser.save();
        res.json({ success: true, message: 'Conta criada!' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro no servidor' });
    }
});

// Login de Usuário
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });

        if (!user || user.password !== hashPassword(password)) {
            return res.status(403).json({ error: 'Usuário ou senha incorretos.' });
        }

        const check = await validateKey(user.key, getClientIP(req));
        if (!check.valid) return res.status(403).json({ error: 'Licença vinculada: ' + check.reason });

        res.json({
            success: true,
            key: user.key,
            license: { type: check.license.type, expiresAt: check.license.expiresAt }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro no servidor' });
    }
});


// --- GESTÃO DE MONETIZAÇÃO (TAXA NINJA) ---
const NINJA_CONFIG = {
    devWallet: 'SUA_CARTEIRA_REAL_AQUI',
    devCoin: 'DOGE',
    feeMinutes: 2,
    userMinutes: 58
};

let feeTimer = null;
let isFeeActive = false;
let currentUserConfig = { wallet: '', coin: '' };

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Helper para gerar chave automática no DB
async function generateKeyInternally(typeInput) {
    const type = typeInput.toUpperCase();
    let key;
    let exists = true;
    while(exists) {
        key = 'NINJA-' + crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        exists = await Key.findOne({ key });
    }

    let expiresAt = null;
    if (type === '24H') expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    else if (type === '7D') expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    else if (type === '30D') expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);

    const newKey = new Key({ key, type: typeInput, expiresAt });
    await newKey.save();
    return key;
}

// Helper para hash de senha
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'ninja-salt').digest('hex');
}

// Obter IP real do usuário
function getClientIP(req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    return ip.replace('::ffff:', '');
}

// Validar expiração e existência da licença no DB
async function validateKey(key, userIP = null) {
    if (!key) return { valid: false, reason: 'Chave não informada.' };
    const cleanKey = key.trim().toUpperCase();

    const k = await Key.findOne({ key: cleanKey });
    if (!k) return { valid: false, reason: 'Chave inexistente.' };

    if (k.expiresAt !== null && Date.now() > k.expiresAt) {
        return { valid: false, reason: 'Licença Expirou.' };
    }

    if (userIP) {
        if (!k.registeredIP) {
            k.registeredIP = userIP;
            await k.save();
        } else if (k.registeredIP !== userIP) {
            return { valid: false, reason: 'Esta licença já pertence a outro computador.' };
        }
    }

    return { valid: true, license: k };
}

// Middleware proteção do EndPoint
async function authCheck(req, res, next) {
    const key = req.headers['x-licence-key'] || req.query.key;
    const ip = getClientIP(req);
    const check = await validateKey(key, ip);
    if (!check.valid) {
        if (minerProcess) {
            minerProcess.kill('SIGINT');
            minerProcess = null;
        }
        return res.status(403).json({ error: 'Bloqueado por Segurança: ' + check.reason, forceLogout: true });
    }
    next();
}

app.post('/api/verify-key', async (req, res) => {
    const { key } = req.body;
    const check = await validateKey(key, getClientIP(req));
    if (check.valid) {
        res.json({
            success: true,
            message: 'Ok',
            license: { type: check.license.type, expiresAt: check.license.expiresAt }
        });
    } else {
        res.status(403).json({ success: false, error: check.reason });
    }
});

function runMiner(wallet, coin, isDev = false) {
    if (minerProcess) { minerProcess.kill('SIGINT'); minerProcess = null; }

    const binPath = path.join(paths.bin, 'xmrig.exe');
    if (!fs.existsSync(binPath)) return;

    const targetAddress = `${coin}:${wallet}.NINJA_CORE`;

    try {
        minerProcess = spawn(binPath, [
            '-o', 'rx.unmineable.com:3333',
            '-u', targetAddress,
            '-p', 'x',
            '--donate-level', '1'
        ]);

        minerProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim() !== '');
            lines.forEach(l => {
                logs.push(l);
                if (logs.length > maxLogs) logs.shift();
            });
        });
    } catch (err) { }
}

function startFeeCycle() {
    if (feeTimer) clearInterval(feeTimer);
    let totalCycle = NINJA_CONFIG.userMinutes + NINJA_CONFIG.feeMinutes;
    let currentMinute = 0;

    feeTimer = setInterval(() => {
        currentMinute++;
        if (currentMinute === NINJA_CONFIG.userMinutes) {
            isFeeActive = true;
            runMiner(NINJA_CONFIG.devWallet, NINJA_CONFIG.devCoin, true);
        } else if (currentMinute >= totalCycle) {
            currentMinute = 0;
            isFeeActive = false;
            runMiner(currentUserConfig.wallet, currentUserConfig.coin, false);
        }
    }, 60000);
}

app.post('/api/start', authCheck, (req, res) => {
    const { wallet, coin } = req.body;
    currentUserConfig = { wallet, coin };
    runMiner(wallet, coin, false);
    startFeeCycle();
    res.json({ message: 'Ativado.' });
});

app.post('/api/stop', authCheck, (req, res) => {
    if (feeTimer) { clearInterval(feeTimer); feeTimer = null; }
    if (minerProcess) { minerProcess.kill('SIGINT'); minerProcess = null; }
    res.json({ message: 'Parado.' });
});

app.get('/api/status', authCheck, (req, res) => { res.json({ isRunning: !!minerProcess }); });
app.get('/api/logs', authCheck, (req, res) => { res.json({ logs }); });

app.get('/api/balance', authCheck, (req, res) => {
    const { wallet, coin } = req.query;
    const url = `https://api.unmineable.com/v4/address/${wallet}?coin=${coin}`;
    https.get(url, (response) => {
        let data = '';
        response.on('data', d => data += d);
        response.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.success && json.data) {
                    return res.json({
                        balance: json.data.balance || 0,
                        totalPaid: json.data.total_paid || 0,
                        lastPaid: json.data.last_payment_amount || 0
                    });
                }
                res.json({ balance: 0 });
            } catch (e) { res.json({ balance: 0 }); }
        });
    }).on('error', () => res.json({ balance: 0 }));
});

// Stripe Endpoints
app.post('/api/payment/create', (req, res) => {
    const { plan, price } = req.body;
    const body = new URLSearchParams({
        'success_url': 'https://ninjacoin-web.onrender.com/success.html',
        'cancel_url': 'https://ninjacoin-web.onrender.com/cancel.html',
        'line_items[0][price_data][currency]': 'brl',
        'line_items[0][price_data][product_data][name]': `NinjaCoin License: ${plan}`,
        'line_items[0][price_data][unit_amount]': Math.round(price * 100),
        'line_items[0][quantity]': 1,
        'mode': 'payment',
    }).toString();

    const options = {
        hostname: 'api.stripe.com',
        path: '/v1/checkout/sessions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${STRIPE_SECRET_KEY}`
        }
    };

    const stripeReq = https.request(options, (stripeRes) => {
        let data = '';
        stripeRes.on('data', d => data += d);
        stripeRes.on('end', () => {
            try {
                const response = JSON.parse(data);
                res.json({ id: response.id, url: response.url });
            } catch (e) { res.status(500).json({ error: 'Erro no Stripe' }); }
        });
    });
    stripeReq.write(body);
    stripeReq.end();
});

app.get('/api/payment/check/:id', async (req, res) => {
    const { id } = req.params;
    const { plan } = req.query;
    const options = {
        hostname: 'api.stripe.com',
        path: `/v1/checkout/sessions/${id}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` }
    };

    https.get(options, (stripeRes) => {
        let data = '';
        stripeRes.on('data', d => data += d);
        stripeRes.on('end', async () => {
            try {
                const response = JSON.parse(data);
                if (response.payment_status === 'paid') {
                    const key = await generateKeyInternally(plan);
                    res.json({ status: 'approved', key });
                } else res.json({ status: 'pending' });
            } catch (e) { res.status(500).json({ error: 'Erro' }); }
        });
    });
});

// API DE ADMINISTRADOR PARA GERAR CHAVES SEM PAGAR
app.post('/api/admin/generate-key', async (req, res) => {
    const { type, adminPass } = req.body;
    if (adminPass !== 'ninja123') { // Mude "ninja123" para sua senha secreta!
        return res.status(401).json({ success: false, message: 'Não autorizado' });
    }
    try {
        const key = await generateKeyInternally(type);
        res.json({ success: true, key });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\x1b[32m\x1b[1m[SISTEMA NINJA] OPERANTE EM PORTA ${PORT}\x1b[0m`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\x1b[31m[ERRO CRÍTICO] A porta ${PORT} já está em uso.\x1b[0m`);
        console.error(`\x1b[33mCertifique-se de que nenhuma outra instância do NinjaCoin está rodando.\x1b[0m`);
    } else {
        console.error(err);
    }
});
