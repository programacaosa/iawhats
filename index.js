const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const arquivoRespostas = path.join(__dirname, 'respostas.txt');

// Função para carregar respostas fixas do txt
function carregarRespostas() {
  try {
    const data = fs.readFileSync(arquivoRespostas, 'utf-8');
    const linhas = data.split('\n').filter(l => !l.match(/^\[\d{4}-\d{2}-\d{2}T/));
    return linhas.filter(l => l.trim() !== '');
  } catch (err) {
    console.error('Erro ao ler arquivo de respostas:', err);
    return [];
  }
}

// Função para calcular similaridade simples entre duas strings
function similaridadeSimples(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  const palavras1 = s1.split(/\W+/).filter(p => p.length > 2);
  const palavras2 = s2.split(/\W+/).filter(p => p.length > 2);

  let iguais = 0;
  for (const p of palavras1) {
    if (palavras2.includes(p)) {
      iguais++;
    }
  }
  return iguais / Math.max(palavras1.length, palavras2.length);
}

// Função para buscar a melhor resposta do txt
function buscarMelhorResposta(msgUsuario) {
  const respostas = carregarRespostas();

  let melhorResposta = null;
  let melhorSim = 0;

  for (const resp of respostas) {
    const sim = similaridadeSimples(msgUsuario, resp);

    // Mostrar no console para treino e diagnóstico
    console.log(`Comparando: "${msgUsuario}" com "${resp}" => Similaridade: ${(sim * 100).toFixed(2)}%`);

    if (sim > melhorSim) {
      melhorSim = sim;
      melhorResposta = resp;
    }
  }

  // Ajuste: para evitar respostas ruins quando não há similaridade suficiente
  if (melhorSim < 0.2) {
    return 'Desculpe, não entendi. Pode reformular?';
  }

  return melhorResposta;
}

// Função para salvar conversas (histórico) no arquivo txt
function salvarConversaNoTxt(remetente, mensagem) {
  const timestamp = new Date().toISOString();
  const linha = `[${timestamp}] ${remetente}: ${mensagem}\n`;
  fs.appendFile(arquivoRespostas, linha, err => {
    if (err) console.error('Erro ao salvar conversa:', err);
  });
}

// Servir o arquivo index.html da raiz
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

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

client.on('message', async msg => {
  console.log('Mensagem recebida:', msg.body);

  salvarConversaNoTxt('Usuário', msg.body);

  const resposta = buscarMelhorResposta(msg.body);

  await msg.reply(resposta);

  salvarConversaNoTxt('Bot', resposta);
});

client.initialize();

io.on('connection', socket => {
  console.log('Cliente conectado ao socket');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
