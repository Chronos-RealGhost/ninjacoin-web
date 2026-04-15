const mongoose = require('mongoose');

// Link do seu banco na nuvem
const MONGODB_URI = 'mongodb+srv://marcosninja402_db_user:APn6XJQAxHyAik9U@cluster0.nypiqjl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function unlockAllKeys() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('\n\x1b[36m[SISTEMA NINJA] Conectando ao Banco para desbloqueio...\x1b[0m');

        // Remove o IP registrado de TODAS as chaves para permitir novo acesso
        const result = await mongoose.connection.collection('keys').updateMany(
            {}, 
            { $set: { registeredIP: null } }
        );

        console.log(`\n\x1b[32m[SUCESSO] ${result.modifiedCount} chaves foram desbloqueadas!\x1b[0m`);
        console.log('\x1b[33mAgora você já pode tentar logar no site do Render novamente.\x1b[0m\n');

        process.exit();
    } catch (err) {
        console.error('Erro ao desbloquear:', err);
        process.exit(1);
    }
}

unlockAllKeys();
