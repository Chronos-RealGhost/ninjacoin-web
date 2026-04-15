const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = __dirname.split(path.sep + 'dist')[0].split(path.sep + 'node_modules')[0];
const keysFilePath = path.join(projectRoot, 'keys.json');

// Cores Ninja Premium
const G = "\x1b[38;2;0;255;136m";  const C = "\x1b[38;2;69;243;255m"; 
const Y = "\x1b[38;2;255;230;0m";  const R = "\x1b[0m"; const B = "\x1b[1m";

console.log(`${Y}${B}[AVISO] Este gerador usa JSON local. Para produção com MongoDB, use 'gerar-minha-chave.js'.${R}`);

function generateUniqueKey(db) {
    let key;
    do {
        key = 'NINJA-' + crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (db[key]);
    return key;
}

const args = process.argv.slice(2);
const type = args[0] ? args[0].toUpperCase() : null;

if (!['24H', '7D', '30D', 'PERM'].includes(type)) {
    console.log(`Uso: node keygen.js <24h|7d|30d|perm>`);
    process.exit(1);
}

if (!fs.existsSync(keysFilePath)) {
    fs.writeFileSync(keysFilePath, JSON.stringify({
        "NINJA-DEV-MASTER": {
            "type": "PERM",
            "createdAt": Date.now(),
            "expiresAt": null
        }
    }, null, 4));
}
const db = JSON.parse(fs.readFileSync(keysFilePath, 'utf-8'));

// Garantir que a Master Key sempre existe
if (!db["NINJA-DEV-MASTER"]) {
    db["NINJA-DEV-MASTER"] = { "type": "PERM", "createdAt": Date.now(), "expiresAt": null };
}

const key = generateUniqueKey(db);
let expiresAt = null;

if (type === '24H') expiresAt = Date.now() + (24 * 60 * 60 * 1000);
else if (type === '7D') expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
else if (type === '30D') expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);

db[key] = { 
    type, 
    createdAt: Date.now(), 
    expiresAt,
    registeredIP: null // Inicialmente nulo, será vinculado no primeiro uso
};

fs.writeFileSync(keysFilePath, JSON.stringify(db, null, 4));

console.log(`\n${C}${B}╔════════════════════════════════════════════╗${R}`);
console.log(`${C}${B}║        NINJACOIN LICENSE GENERATOR         ║${R}`);
console.log(`${C}${B}╠════════════════════════════════════════════╣${R}`);
console.log(`${C}${B}║  TIPO: ${type.padEnd(35)} ║${R}`);
console.log(`${C}${B}║  KEY:  ${G}${key.padEnd(35)}${C}║${R}`);
console.log(`${C}${B}╠════════════════════════════════════════════╣${R}`);
console.log(`${C}   Sincronizado em: ${keysFilePath}${R}`);

// Sincronização inteligente com pastas de Build (se existirem)
const possiblePaths = [
    path.join(projectRoot, 'dist', 'keys.json'),                 // Direto no dist (para o Portable)
    path.join(projectRoot, 'dist', 'win-unpacked', 'keys.json')  // No Win-Unpacked
];

possiblePaths.forEach(p => {
    if (fs.existsSync(path.dirname(p))) {
        fs.writeFileSync(p, JSON.stringify(db, null, 4));
        const relativePath = path.relative(projectRoot, p);
        console.log(`${G}   [OK] Sincronizado com: ${relativePath}${R}`);
    }
});

console.log(`${C}${B}╚════════════════════════════════════════════╝${R}\n`);
