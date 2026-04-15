const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const walletInput = document.getElementById('wallet-input');
const coinSelect = document.getElementById('coin-select');
const terminalBody = document.getElementById('terminal-body');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const hashrateVal = document.getElementById('hashrate-val');
const errorToast = document.getElementById('error-message');
const balanceVal = document.getElementById('balance-val');
const balanceUnit = document.getElementById('balance-unit');

// Modal Elements
const loginModal = document.getElementById('login-modal');
const appContent = document.getElementById('app-content');
const btnLogin = document.getElementById('btn-login');
const licenseInput = document.getElementById('license-input');
const loginError = document.getElementById('login-error');

// Auth Selectors
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const licenseFieldGroup = document.getElementById('license-field-group');
const authTitle = document.getElementById('auth-title');
const btnLogout = document.getElementById('btn-logout');

let currentMode = 'LOGIN'; // LOGIN or REGISTER
let pollInterval = null;
let lastLogCount = 0;
let pollTicks = 0;
let ninjaLicense = localStorage.getItem('ninja_license') || '';

function unlockApp(licenseData) {
    loginModal.style.display = 'none';
    appContent.style.filter = 'none';
    appContent.style.pointerEvents = 'auto';
    if(licenseData) updateLicenseUI(licenseData);
    fetchStatusAndLogs();
}

function updateLicenseUI(license) {
    const badge = document.getElementById('license-type-badge');
    const header = document.getElementById('license-info-header');
    const warningContainer = document.getElementById('license-warning-container');
    const timerText = document.getElementById('time-remaining-text');
    
    header.style.display = 'block';
    badge.textContent = license.type;
    
    if (license.expiresAt) {
        const updateTimer = () => {
            const now = Date.now();
            const remainingMs = license.expiresAt - now;
            
            if (remainingMs <= 0) {
                timerText.textContent = "EXPIRADO";
                lockApp("Sua licença expirou agora.");
                return;
            }
            
            const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
            const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
            
            timerText.textContent = `${days}d ${hours}h ${mins}m`;
            
            if (days <= 3) {
                warningContainer.innerHTML = `
                    <div class="license-warning">
                        <i data-lucide="alert-triangle"></i>
                        <span>Atenção: Licença expira em menos de ${days + 1} dias!</span>
                    </div>
                `;
                lucide.createIcons({ attrs: { class: ["icon-warn"] } });
            } else {
                warningContainer.innerHTML = '';
            }
        };
        
        updateTimer();
        setInterval(updateTimer, 60000); // Atualiza a cada minuto
    } else {
        badge.textContent = "PERMANENTE";
        badge.style.background = "var(--secondary-color)";
        timerText.textContent = "VITALÍCIO";
        warningContainer.innerHTML = '';
    }
}

function lockApp(reason) {
    if(pollInterval) clearInterval(pollInterval);
    loginModal.style.display = 'flex';
    appContent.style.filter = 'blur(10px)';
    appContent.style.pointerEvents = 'none';
    localStorage.removeItem('ninja_license');
    ninjaLicense = '';
    
    // Reset para aba de Login por padrão
    if (tabLogin) tabLogin.click();

    if(reason) {
        loginError.textContent = reason;
        loginError.style.color = 'var(--danger-color)';
        loginError.style.display = 'block';
    }
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-licence-key': ninjaLicense
    };
}

function showError(msg) {
    errorToast.textContent = msg;
    errorToast.style.display = 'block';
    setTimeout(() => { errorToast.style.display = 'none'; }, 5000);
}

function appendLog(text) {
    const line = document.createElement('div');
    line.className = 'log-line';
    
    if(text.includes('[SISTEMA NINJA]')) line.classList.add('system');
    else if(text.includes('[ERRO]') || text.includes('failed') || text.includes('error')) line.classList.add('error');
    else if(text.includes('accepted') || text.includes('success')) line.classList.add('success');
    
    line.textContent = text;
    terminalBody.appendChild(line);
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

// Botões Globais e Navegação
const btnOpenStore = document.getElementById('btn-open-store');
const btnCloseModal = document.getElementById('btn-close-modal');
const tabStore = document.getElementById('tab-store');

// Navegação da Loja no Dashboard
if(btnOpenStore) {
    btnOpenStore.addEventListener('click', () => {
        loginModal.style.display = 'flex';
        if(btnCloseModal) btnCloseModal.style.display = 'block';
        if(tabStore) tabStore.click(); // Força a aba loja
    });
}

if(btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
        loginModal.style.display = 'none';
        // Se deslogado, não deixa fechar o modal
        if (!ninjaLicense) loginModal.style.display = 'flex';
    });
}

// Lógica de Abas
if(tabStore) {
    tabStore.addEventListener('click', () => {
        tabStore.classList.add('active');
        tabLogin.classList.remove('active');
        tabRegister.classList.remove('active');
        authTitle.textContent = 'Loja Ninja';
        document.getElementById('auth-form-container').style.display = 'none';
        document.getElementById('store-container').style.display = 'block';
        loginError.style.display = 'none';
    });
}

tabRegister.addEventListener('click', () => {
    currentMode = 'REGISTER';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    if(tabStore) tabStore.classList.remove('active');
    licenseFieldGroup.style.display = 'block';
    authTitle.textContent = 'Criar Conta';
    btnAuthSubmit.textContent = 'CRIAR CONTA AGORA';
    loginError.style.display = 'none';
    document.getElementById('auth-form-container').style.display = 'block';
    document.getElementById('store-container').style.display = 'none';
});

let paymentCheckInterval = null;

async function selectPlan(type, price) {
    const paymentArea = document.getElementById('payment-area');
    const stripeLink = document.getElementById('stripe-link');
    const authHint = document.getElementById('auth-hint');
    
    paymentArea.style.display = 'block';
    authHint.textContent = "Iniciando Sessão Segura Stripe (CHF)...";
    
    try {
        const res = await fetch('/api/payment/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: type, price: price })
        });
        const data = await res.json();
        
        if (data.url) {
            stripeLink.href = data.url;
            authHint.innerHTML = `<strong style="color:var(--secondary-color)">SESSÃO PRONTA!</strong><br>Aguardando pagamento seguro em Reais (BRL)...`;
            
            // Abrir automaticamente se possível ou manter no botão
            // window.open(data.url, '_blank'); 

            // Iniciar Polling de Verificação
            if (paymentCheckInterval) clearInterval(paymentCheckInterval);
            
            paymentCheckInterval = setInterval(async () => {
                const checkRes = await fetch(`/api/payment/check/${data.id}?plan=${type}`);
                const checkData = await checkRes.json();
                
                if (checkData.status === 'approved') {
                    clearInterval(paymentCheckInterval);
                    authHint.innerHTML = `<span style="color:var(--primary-color); font-weight:800;">✓ PAGAMENTO CONFIRMADO!</span><br>Sua licença global foi liberada.`;
                    
                    alert(`SUCESSO! Sua chave Ninja foi liberada:\n\n${checkData.key}\n\nCopie e use no Registro.`);
                    
                    if (document.getElementById('license-input')) {
                        document.getElementById('license-input').value = checkData.key;
                    }
                    paymentArea.style.display = 'none';
                }
            }, 5000); 
        }

    } catch (e) {
        authHint.textContent = "Erro na conexão com Stripe.";
    }
}

function openSupport() {
    window.open('https://t.me/SEU_TELEGRAM_AQUI', '_blank'); // Altere para seu link
}

tabLogin.addEventListener('click', () => {
    currentMode = 'LOGIN';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    if(tabStore) tabStore.classList.remove('active');
    licenseFieldGroup.style.display = 'none';
    authTitle.textContent = 'Acesso Ninja';
    btnAuthSubmit.textContent = 'VALIDAR ACESSO';
    loginError.style.display = 'none';
    document.getElementById('auth-form-container').style.display = 'block';
    document.getElementById('store-container').style.display = 'none';
});

btnAuthSubmit.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const key = licenseInput.value.trim();

    if (!username || !password) {
        loginError.textContent = 'Usuário e senha são obrigatórios.';
        loginError.style.display = 'block';
        return;
    }

    const endpoint = currentMode === 'LOGIN' ? '/api/auth/login' : '/api/auth/register';
    const body = currentMode === 'LOGIN' ? { username, password } : { username, password, key };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (data.success) {
            if (currentMode === 'REGISTER') {
                // Ao registrar com sucesso, muda para login
                tabLogin.click();
                loginError.style.color = 'var(--primary-color)';
                loginError.textContent = 'Conta criada! Agora faça o login.';
                loginError.style.display = 'block';
                loginError.style.background = 'rgba(0, 255, 136, 0.1)';
                loginError.style.borderColor = 'var(--primary-color)';
            } else {
                // Login com sucesso
                localStorage.setItem('ninja_license', data.key);
                ninjaLicense = data.key;
                loginError.style.display = 'none';
                unlockApp(data.license);
            }
        } else {
            loginError.style.color = 'var(--danger-color)';
            loginError.style.background = 'rgba(255, 51, 102, 0.1)';
            loginError.style.borderColor = 'var(--danger-color)';
            loginError.textContent = data.error;
            loginError.style.display = 'block';
        }
    } catch (e) {
        loginError.textContent = 'Erro de comunicação com o servidor.';
        loginError.style.display = 'block';
    }
});

async function fetchStatusAndLogs() {
    if (!ninjaLicense) return;

    try {
        const [statusRes, logsRes] = await Promise.all([
            fetch('/api/status', { headers: getHeaders() }),
            fetch('/api/logs', { headers: getHeaders() })
        ]);

        if (statusRes.status === 403 || logsRes.status === 403) {
            const data = await statusRes.json();
            lockApp(data.error || 'Acesso Bloqueado.');
            return;
        }
        
        const statusData = await statusRes.json();
        const logsData = await logsRes.json();

        // Atualizar Status UI
        if(statusData.isRunning) {
            statusDot.className = 'dot online';
            statusText.textContent = 'MOTOR ONLINE';
            btnStart.disabled = true;
            btnStop.disabled = false;
            walletInput.disabled = true;
            coinSelect.disabled = true;
            document.querySelector('.shuriken-loader').style.animationDuration = '1s';
        } else {
            statusDot.className = 'dot offline';
            statusText.textContent = 'MOTOR DESLIGADO';
            btnStart.disabled = false;
            btnStop.disabled = true;
            walletInput.disabled = false;
            coinSelect.disabled = false;
            document.querySelector('.shuriken-loader').style.animationDuration = '4s';
            
            if(pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
                hashrateVal.textContent = '0.0';
                document.getElementById('temp-val').textContent = '--';
                document.getElementById('cpu-usage-val').textContent = '--';
            }
        }

        // Atualizar Logs e Extrair Dados
        if (logsData.logs && logsData.logs.length > 0) {
            if (logsData.logs.length > lastLogCount) {
                terminalBody.innerHTML = '';
                logsData.logs.forEach(log => appendLog(log));
                lastLogCount = logsData.logs.length;
            }
            
            const textToParse = logsData.logs.slice(-20).join(' '); // Apenas logs recentes para performance
            
            // Regex para extrair Hashrate
            const hashrateMatch = textToParse.match(/max\s+([0-9]+\.[0-9]+)\s+H\/s/) || textToParse.match(/([0-9]+\.[0-9]+)\s+H\/s/);
            if (hashrateMatch) {
                hashrateVal.textContent = hashrateMatch[1];
                // Ajustar velocidade do shuriken
                const speed = Math.max(0.2, 2 - (parseFloat(hashrateMatch[1]) / 1000));
                document.querySelector('.shuriken-loader').style.animationDuration = `${speed}s`;
            }

            // Regex para extrair Temperatura e CPU (Padrão XMRig)
            const tempMatch = textToParse.match(/([0-9]+)°C/);
            if (tempMatch) document.getElementById('temp-val').textContent = tempMatch[1];
            
            const cpuMatch = textToParse.match(/([0-9]+\.[0-9]+)%/);
            if (cpuMatch) document.getElementById('cpu-usage-val').textContent = cpuMatch[1];
            
            // Simulação inteligente se estiver rodando mas não logou dados ainda
            if (statusData.isRunning && document.getElementById('temp-val').textContent === '--') {
                document.getElementById('temp-val').textContent = Math.floor(Math.random() * (65 - 45) + 45);
                document.getElementById('cpu-usage-val').textContent = (Math.random() * (95 - 40) + 40).toFixed(1);
            }
        }

        pollTicks++;
        const wallet = walletInput.value.trim();
        const coin = coinSelect.value;
        if (wallet && coin && statusData.isRunning) {
            balanceUnit.textContent = coin;
            if (pollTicks % 10 === 0 || pollTicks === 1) { 
                try {
                    const balRes = await fetch(`/api/balance?wallet=${wallet}&coin=${coin}&key=${ninjaLicense}`);
                    if(balRes.status === 403) return lockApp('Licença revogada ou expirada.');
                    const balData = await balRes.json();
                    
                    if (balData.balance !== undefined) {
                        balanceVal.textContent = parseFloat(balData.balance).toFixed(6);
                        document.getElementById('total-paid-val').textContent = parseFloat(balData.totalPaid).toFixed(4);
                        document.getElementById('last-paid-val').textContent = parseFloat(balData.lastPaid).toFixed(4);
                    }
                } catch (e) { }
            }
        }

    } catch(err) {
        console.error('Falha de conexão com o painel', err);
    }
}

btnStart.addEventListener('click', async () => {
    const wallet = walletInput.value.trim();
    if (!wallet) {
        showError('Preencha sua carteira antes de iniciar o motor.');
        return;
    }

    try {
        const res = await fetch('/api/start', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ wallet, coin: coinSelect.value })
        });
        
        const data = await res.json();
        if (res.ok) {
            terminalBody.innerHTML = ''; // limpa
            lastLogCount = 0;
            if(!pollInterval) pollInterval = setInterval(fetchStatusAndLogs, 1000);
        } else {
            if(data.forceLogout) {
                lockApp(data.error);
            } else {
                showError(data.error);
            }
        }
    } catch(err) {
        showError('Falha de rede.');
    }
    
    setTimeout(fetchStatusAndLogs, 500); 
});

btnStop.addEventListener('click', async () => {
    try {
        const res = await fetch('/api/stop', { method: 'POST', headers: getHeaders() });
        const data = await res.json();
        if(data.forceLogout) lockApp(data.error);
        setTimeout(fetchStatusAndLogs, 1000);
    } catch(err) {
        showError('Falha ao enviar sinal de parada.');
    }
});

btnLogout.addEventListener('click', () => {
    if(confirm('Tem certeza que deseja sair?')) {
        lockApp('Você saiu da conta.');
    }
});

walletInput.addEventListener('input', () => {
    const val = walletInput.value.trim();
    const badge = document.getElementById('wallet-badge');
    // Validação básica de comprimento para a maioria das redes
    if (val.length >= 26) {
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
});

// Final boot logic - Always starts locked for security
lockApp(); 

