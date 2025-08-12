const { Client } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const axios = require('axios');
const path = require('path');

const GEMINI_API_KEY = 'AIzaSyDMGFsrxCqCsP2yX_3pE6I7oW9W7ftQPD8'; // 🔐 Proteja essa chave em produção
const app = express();
const port = 3000;

let qrImageData = null;

const client = new Client();

client.on('qr', async qr => {
  try {
    qrImageData = await qrcode.toDataURL(qr);
    console.log('📸 QR Code gerado!');
  } catch (err) {
    console.error('❌ Erro ao gerar QR Code:', err.message);
  }
});

client.on('ready', () => {
  console.log('✅ Bot está pronto e conectado ao WhatsApp!');
});

client.on('message', async msg => {
  const pergunta = msg.body?.trim();

  if (!pergunta) return;

  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{ parts: [{ text: pergunta }] }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        }
      }
    );

const respostaGemini = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (respostaGemini) {
      msg.reply(respostaGemini);
    } else {
      msg.reply('⚠️ A IA não retornou uma resposta válida.');
      console.warn('Resposta inesperada da IA:', response.data);
    }
  } catch (error) {
    console.error('❌ Erro ao consultar a IA:', error.response?.data || error.message);
    msg.reply('❌ Erro ao consultar a IA. Verifique a chave da API ou tente novamente.');
  }
});

client.initialize();

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>QR Code WhatsApp</title></head>
      <body>
        <h1>📱 Escaneie o QR Code para iniciar o bot</h1>
        ${qrImageData ? `<img src="${qrImageData}" alt="QR Code">` : '<p>Aguardando geração do QR Code. Isso pode levar alguns segundos aguarde...</p>'}
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`🌐 Acesse http://localhost:${port} para ver o QR Code`);
});
