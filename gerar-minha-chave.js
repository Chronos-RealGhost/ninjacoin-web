const mongoose = require('mongoose');
const crypto = require('crypto');

// Link do seu banco na nuvem
const MONGODB_URI = 'mongodb+srv://marcosninja402_db_user:APn6XJQAxHyAik9U@cluster0.nypiqjl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Definição do Esquema (o mesmo do server.js)
const KeySchema = new mongoose.Schema({
    key: String,
    type: String, // '24h', '7d', '30d', 'lifetime'
    status: { type: String, default: 'active' },
    usedBy: { type: String, default: null },
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now }
});

const Key = mongoose.model('Key', KeySchema);

async function generateMasterKey() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Conectado ao Banco Ninja...');

        const masterKey = 'NINJA-MASTER-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        
        const newKey = new Key({
            key: masterKey,
            type: 'lifetime',
            expiresAt: new Date('2099-12-31') // Validade quase eterna
        });

        await newKey.save();
        
        console.log('\n\x1b[32m====================================');
        console.log('Sua Chave Vitalícia foi Gerada!');
        console.log('CHAVE:', masterKey);
        console.log('TIPO: VITÁLICIA (LIFETIME)');
        console.log('====================================\x1b[0m\n');

        process.exit();
    } catch (err) {
        console.error('Erro ao gerar chave:', err);
    }
}

generateMasterKey();
