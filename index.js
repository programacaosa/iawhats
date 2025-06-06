const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configurações
const GEMINI_API_KEY = 'AIzaSyBrGqcwNsDDrBcSOzAuMtZkomexJg4xsSU';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Rotas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/sender', (req, res) => {
    res.sendFile(path.join(__dirname, 'sender.html'));
});

app.post('/send-messages', async (req, res) => {
    if (!client.info) {
        return res.status(400).json({ error: 'WhatsApp não está conectado' });
    }

    const { numbers, message } = req.body;
    
    try {
        const results = [];
        for (const number of numbers) {
            const formattedNumber = number.replace(/\D/g, '');
            const chatId = formattedNumber.includes('@') 
                ? formattedNumber 
                : `${formattedNumber}@c.us`;
            
            await client.sendMessage(chatId, message);
            results.push({ number, status: 'success' });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Funções de pré-processamento ---
const removeAccents = (text) => {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
};

const preprocess = (text) => {
    return removeAccents(text.toLowerCase().replace(/[^\w\s]/gi, '').trim());
};

// --- Carrega os prompts ---
let prompts = [];
try {
    prompts = fs.readFileSync(path.join(__dirname, 'prompts.txt'), 'utf8').split('\n').filter(Boolean);
    console.log(`${prompts.length} prompts carregados`);
} catch (err) {
    console.error('Erro ao ler prompts.txt:', err);
    process.exit(1);
}

// --- Gemini API ---
async function getGeminiResponse(prompt, message) {
    try {
        const response = await axios.post(GEMINI_API_URL, {
            contents: [{
                parts: [{
                    text: `${prompt}\n\nMensagem do usuário: ${message}`
                }]
            }]
        });
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Erro na API Gemini:', error.response?.data || error.message);
        return 'Estou tendo dificuldades técnicas. Por favor, tente novamente mais tarde.';
    }
}

// --- WhatsApp Client ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox']
    }
});

// Eventos do WhatsApp
client.on('qr', (qr) => {
    console.log('QR RECEBIDO');
    qrcode.toDataURL(qr, (err, url) => {
        if (err) return console.error(err);
        io.emit('qr', url);
    });
});

client.on('ready', () => {
    console.log('Cliente pronto!');
    io.emit('ready', 'WhatsApp conectado!');
});

client.on('disconnected', (reason) => {
    console.log('Cliente desconectado:', reason);
    io.emit('disconnected', reason);
});

client.on('message', async msg => {
    if (msg.from === 'status@broadcast') return;
    
    console.log('Mensagem de', msg.from, ':', msg.body);
    
    try {
        let melhorPrompt = prompts[0];
        let melhorSimilaridade = 0;
        
        for (const prompt of prompts) {
            const exemplo = prompt.split('---')[0];
            const similaridade = jaccardSimilarity(exemplo, msg.body);
            if (similaridade > melhorSimilaridade) {
                melhorSimilaridade = similaridade;
                melhorPrompt = prompt;
            }
        }
        
        console.log(`Prompt selecionado (similaridade: ${melhorSimilaridade.toFixed(2)})`);
        const resposta = await getGeminiResponse(melhorPrompt, msg.body);
        await msg.reply(resposta);
        
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        await msg.reply('Houve um erro ao processar sua mensagem. Por favor, tente novamente.');
    }
});

// Função Jaccard Similarity
function jaccardSimilarity(a, b) {
    const setA = new Set(preprocess(a).split(" "));
    const setB = new Set(preprocess(b).split(" "));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
}

// Inicialização
client.initialize().catch(err => {
    console.error('Erro na inicialização:', err);
    process.exit(1);
});

// Socket.io
io.on('connection', (socket) => {
    console.log('Cliente conectado ao socket');
    socket.on('disconnect', () => console.log('Cliente desconectado do socket'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
