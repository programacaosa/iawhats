const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const GEMINI_API_KEY = 'AIzaSyDMGFsrxCqCsP2yX_3pE6I7oW9W7ftQPD8';

const client = new Client();

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('💬 Bot pronto!');
});

client.on('message', async message => {
  const userText = message.body;

  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{ parts: [{ text: userText }] }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY
        }
      }
    );

    const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) {
      message.reply(reply);
    } else {
      message.reply('Não consegui entender a resposta 😕');
    }
  } catch (err) {
    console.error('Erro na API Gemini:', err);
    message.reply('Erro ao consultar a IA 😔');
  }
});

client.initialize();
