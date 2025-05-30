const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const client = new Client({
    authStrategy: new LocalAuth()
});

let grupoPermitidoId = null; // Será definido após encontrar o grupo "CASAL10"

// Funções de pré-processamento
const removeAccents = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
const preprocess = (text) => removeAccents(text.toLowerCase().replace(/[^\w\s]/gi, '').trim());
const jaccardSimilarity = (a, b) => {
    const setA = new Set(preprocess(a).split(" "));
    const setB = new Set(preprocess(b).split(" "));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
};

// Carrega as respostas
const respostas = fs.readFileSync(__dirname + '/respostas.txt', 'utf8').split('\n').filter(Boolean);

// Rota
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// QR Code
client.on('qr', (qr) => {
    console.log('QR RECEBIDO', qr);
    qrcode.toDataURL(qr, (err, url) => {
        if (!err) io.emit('qr', url);
    });
});

// Após login, buscar o grupo pelo nome
client.on('ready', async () => {
    console.log('Cliente pronto!');
    io.emit('ready', 'WhatsApp está conectado!');

    const chats = await client.getChats();
    const grupo = chats.find(chat => chat.isGroup && chat.name.toLowerCase() === 'casal10');

    if (grupo) {
        grupoPermitidoId = grupo.id._serialized;
        console.log(`Grupo CASAL10 encontrado! ID: ${grupoPermitidoId}`);
    } else {
        console.warn('Grupo CASAL10 não encontrado. O bot ficará inativo.');
    }
});

// Responde apenas no grupo permitido
client.on('message', async msg => {
    if (!grupoPermitidoId || msg.from !== grupoPermitidoId) {
        return; // Ignora mensagens de outros grupos ou chats privados
    }

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
    await msg.reply(melhorFrase);
});

client.initialize();

io.on('connection', socket => {
    console.log('Cliente conectado ao socket');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
