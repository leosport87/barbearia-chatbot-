const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const { processar } = require('./bot');
const { getAgendamentosProxima1h, getHoje } = require('./agenda');
const { iniciarPainel } = require('./painel');
const { carregar, salvar } = require('./storage');

const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: { type: 'none' },
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('Escaneie o QR Code acima com o WhatsApp.');
});

client.on('ready', () => {
  console.log('Bot conectado e pronto!');
});

client.on('disconnected', async (reason) => {
  console.log('Desconectado:', reason);
  setTimeout(async () => {
    await client.initialize();
  }, 5000);
});

client.on('message', async msg => {
  if (msg.from.endsWith('@g.us') || msg.fromMe) return;
  try {
    await processar(msg, client);
  } catch (err) {
    console.error('Erro ao processar mensagem:', err);
  }
});

// Lembrete 1h antes
cron.schedule('* * * * *', async () => {
  const proximos = getAgendamentosProxima1h();
  const dados = carregar();

  for (const ag of proximos) {
    if (ag.lembreteEnviado) continue;
    try {
      await client.sendMessage(ag.numero,
        `Olá, *${ag.nome}*! Lembrete: você tem um agendamento na *Allyson Barbearia Studio Tattoo*\n\n` +
        `✂️ *${ag.servico}*\n` +
        `📅 *${new Date(ag.data.split('/').reverse().join('-') + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}*\n` +
        `🕐 *${ag.horario}*\n\n` +
        `Te esperamos! ✂️`
      );
      console.log(`Lembrete enviado para ${ag.numero}`);
      dados[ag.id] = { ...dados[ag.id], lembreteEnviado: true };
      salvar(dados);
    } catch (e) {
      console.error('Erro ao enviar lembrete:', e);
    }
  }
});

// Agradecimento 25 minutos após o fim do serviço
cron.schedule('* * * * *', async () => {
  const dados = carregar();
  const agora = new Date();
  const hoje = getHoje();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();

  for (const [id, ag] of Object.entries(dados)) {
    if (ag.data !== hoje) continue;
    if (ag.agradecimentoEnviado) continue;
    if (!ag.duracao) continue;

    const [h, m] = ag.horario.split(':').map(Number);
    const inicioMin = h * 60 + m;
    const fimMin = inicioMin + ag.duracao + 25;

    if (agoraMin < fimMin) continue;

    try {
      await client.sendMessage(ag.numero,
        `Olá, *${ag.nome}*! 😊\n\n` +
        `Obrigado pela confiança e por escolher a *Allyson Barbearia Studio Tattoo*! ✂️\n\n` +
        `Foi um prazer te atender. Esperamos te ver em breve! 🙏\n\n` +
        `_Qualquer dúvida, estamos à disposição._`
      );
      console.log(`Agradecimento enviado para ${ag.numero}`);
      dados[id] = { ...dados[id], agradecimentoEnviado: true };
      salvar(dados);
    } catch (e) {
      console.error('Erro ao enviar agradecimento:', e);
    }
  }
});

iniciarPainel(3000);
client.initialize();