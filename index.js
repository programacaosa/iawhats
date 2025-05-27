const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- Funções de pré-processamento e similaridade ---
const removeAccents = (text) => {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
};

const preprocess = (text) => {
    return removeAccents(text.toLowerCase().replace(/[^\w\s]/gi, '').trim());
};

const jaccardSimilarity = (a, b) => {
    const setA = new Set(preprocess(a).split(" "));
    const setB = new Set(preprocess(b).split(" "));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
};

// --- Carrega as respostas do TXT ---
const respostas = fs.readFileSync(__dirname + '/respostas.txt', 'utf8').split('\n').filter(Boolean);

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('QR RECEBIDO', qr);
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error(err);
            return;
        }
        io.emit('qr', url);
    });
});

client.on('ready', () => {
    console.log('Cliente pronto!');
    io.emit('ready', 'WhatsApp está conectado!');
});

// --- Processamento inteligente da mensagem ---
client.on('message', async msg => {
    console.log('Mensagem recebida:', msg.body);

    const mensagemUsuario = msg.body;
    let melhorFrase = 'Desculpe, não entendi bem. Pode reformular?';
    let melhorSimilaridade = 0;

    for (const frase of respostas) {
        const similaridade = jaccardSimilarity(frase, mensagemUsuario);
        if (similaridade > melhorSimilaridade) {
            melhorSimilaridade = similaridade;
            melhorFrase = frase;
        }
    }

    console.log(`Melhor similaridade: ${melhorSimilaridade.toFixed(2)}`);

    msg.reply(melhorFrase);
});

client.initialize();

io.on('connection', socket => {
    console.log('Cliente conectado ao socket');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
