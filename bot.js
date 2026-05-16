const { SERVICOS, TOLERANCIA, formatarDuracao, getHorariosLivres, getProximosDias, agendar, cancelar, getAgendamentosCliente, getHoje, isDiaBloqueado } = require('./agenda');

const sessoes = {};

function getEstado(numero) {
  return sessoes[numero] || { etapa: 'menu' };
}

function setEstado(numero, estado) {
  sessoes[numero] = estado;
}

function resetar(numero) {
  delete sessoes[numero];
}

function menuServicos() {
  return Object.entries(SERVICOS)
    .map(([k, v]) => `*${k}. ${v.nome}*\n    💰 R$${v.valor} · ⏱ ${formatarDuracao(v.duracao)}`)
    .join('\n\n');
}

async function processar(msg, client) {
  const numero = msg.from;
  const texto = msg.body.trim().toLowerCase();
  const textoOriginal = msg.body.trim();
  const estado = getEstado(numero);

  const agora = new Date();
  const diaSemana = agora.getDay();
  const totalMin = agora.getHours() * 60 + agora.getMinutes();
  const aberto = diaSemana !== 0 && totalMin >= 9 * 60 && totalMin < 20 * 60;

  if (!aberto) {
    return client.sendMessage(numero,
      `Olá! No momento estamos fechados. 🕐\n\n` +
      `*Horário de atendimento:*\n` +
      `Seg a Sáb: 09h às 20h\n` +
      `Domingo: fechado\n\n` +
      `Quando estivermos abertos, é só mandar *oi* para agendar! ✂️`
    );
  }

  if (texto === 'menu' || texto === 'oi' || texto === 'olá' || texto === 'ola') {
    const hoje = getHoje();
    const bloqueio = isDiaBloqueado(hoje);
    if (bloqueio === 'dia inteiro') {
      return client.sendMessage(numero,
        `Olá! Infelizmente hoje não estamos atendendo. 😔\n\nAté logo! ✂️`
      );
    }
    setEstado(numero, { etapa: 'menu' });
    return client.sendMessage(numero,
      `Olá! Bem-vindo à *Allyson Barbearia Studio Tattoo* ✂️\n\n` +
      `O que deseja fazer?\n\n` +
      `1️⃣ Agendar horário\n` +
      `2️⃣ Cancelar agendamento\n` +
      `3️⃣ Meus agendamentos\n\n` +
      `_Digite o número da opção._`
    );
  }

  if (estado.etapa === 'menu' && texto === '1') {
    const dias = getProximosDias();
    if (dias.length === 0) {
      resetar(numero);
      return client.sendMessage(numero, 'Não há dias disponíveis no momento. 😔\n\nDigite *menu* para voltar.');
    }
    const lista = dias.map((d, i) => `${i + 1}. ${d.label} — ${d.dataStr}`).join('\n');
    setEstado(numero, { etapa: 'escolher_dia', dias });
    return client.sendMessage(numero,
      `Qual dia deseja agendar?\n\n${lista}\n\nDigite o *número* do dia.`
    );
  }

  if (estado.etapa === 'escolher_dia') {
    const idx = parseInt(texto) - 1;
    if (isNaN(idx) || idx < 0 || idx >= estado.dias.length) {
      return client.sendMessage(numero, 'Opção inválida. Digite o número do dia.');
    }
    const dia = estado.dias[idx];
    setEstado(numero, { etapa: 'escolher_servico', dia });
    return client.sendMessage(numero,
      `*${dia.label} — ${dia.dataStr}*\n\nQual serviço deseja?\n\n${menuServicos()}\n\nDigite o *número* do serviço.`
    );
  }

  if (estado.etapa === 'escolher_servico') {
    const servico = SERVICOS[texto];
    if (!servico) {
      return client.sendMessage(numero, 'Opção inválida. Digite o número do serviço.');
    }
    const livres = getHorariosLivres(servico.slots, estado.dia.dataStr);
    if (livres.length === 0) {
      resetar(numero);
      return client.sendMessage(numero,
        `Não há horários disponíveis para *${servico.nome}* nesse dia. 😔\n\nDigite *menu* para voltar.`
      );
    }
    const lista = livres.map((h, i) => `${i + 1}. ${h}`).join('\n');
    setEstado(numero, { etapa: 'escolher_horario', servico, horarios: livres, dia: estado.dia });
    return client.sendMessage(numero,
      `Horários disponíveis para *${servico.nome}*:\n\n${lista}\n\nDigite o *número* do horário desejado.`
    );
  }

  if (estado.etapa === 'escolher_horario') {
    const idx = parseInt(texto) - 1;
    if (isNaN(idx) || idx < 0 || idx >= estado.horarios.length) {
      return client.sendMessage(numero, 'Opção inválida. Digite o número correspondente ao horário.');
    }
    const horario = estado.horarios[idx];
    setEstado(numero, { etapa: 'confirmar_nome', horario, servico: estado.servico, dia: estado.dia });
    return client.sendMessage(numero,
      `Ótimo! *${estado.servico.nome}* em *${estado.dia.label}* às *${horario}*.\n\nQual o seu nome completo?`
    );
  }

  if (estado.etapa === 'confirmar_nome') {
    const nome = textoOriginal;
    agendar(numero, estado.horario, estado.dia.dataStr, nome, estado.servico);
    resetar(numero);
    return client.sendMessage(numero,
      `Agendamento confirmado! ✅\n\n` +
      `👤 *${nome}*\n` +
      `✂️ *${estado.servico.nome}*\n` +
      `💰 *R$${estado.servico.valor}*\n` +
      `📅 *${estado.dia.label} — ${estado.dia.dataStr}*\n` +
      `🕐 *${estado.horario}*\n\n` +
      `⏰ *Tolerância de atraso: ${TOLERANCIA} minutos*\n` +
      `_Após esse tempo o horário poderá ser liberado._\n\n` +
      `Você receberá um lembrete 1h antes. Até lá! ✂️`
    );
  }

  if (estado.etapa === 'menu' && texto === '2') {
    const agendamentos = getAgendamentosCliente(numero);
    if (agendamentos.length === 0) {
      resetar(numero);
      return client.sendMessage(numero, 'Você não possui agendamentos.\n\nDigite *menu* para voltar.');
    }
    const lista = agendamentos.map((a, i) => `${i + 1}. ${a.data} às ${a.horario} — ${a.servico}`).join('\n');
    setEstado(numero, { etapa: 'escolher_cancelar', agendamentos });
    return client.sendMessage(numero,
      `Seus agendamentos:\n\n${lista}\n\nDigite o *número* que deseja cancelar.`
    );
  }

  if (estado.etapa === 'escolher_cancelar') {
    const idx = parseInt(texto) - 1;
    if (isNaN(idx) || idx < 0 || idx >= estado.agendamentos.length) {
      return client.sendMessage(numero, 'Opção inválida. Tente novamente.');
    }
    const agendamento = estado.agendamentos[idx];
    setEstado(numero, { etapa: 'confirmar_cancelar', agendamento });
    return client.sendMessage(numero,
      `Confirmar cancelamento?\n\n✂️ *${agendamento.servico}*\n📅 *${agendamento.data} às ${agendamento.horario}*\n\n1. Sim, cancelar\n2. Não, voltar`
    );
  }

  if (estado.etapa === 'confirmar_cancelar') {
    if (texto === '1') {
      cancelar(estado.agendamento.id);
      resetar(numero);
      return client.sendMessage(numero, 'Agendamento cancelado com sucesso. ✅\n\nDigite *menu* para voltar.');
    }
    resetar(numero);
    return client.sendMessage(numero, 'Cancelamento abortado.\n\nDigite *menu* para voltar.');
  }

  if (estado.etapa === 'menu' && texto === '3') {
    const agendamentos = getAgendamentosCliente(numero);
    if (agendamentos.length === 0) {
      resetar(numero);
      return client.sendMessage(numero, 'Você não possui agendamentos. 😊\n\nDigite *menu* para voltar.');
    }
    const lista = agendamentos.map(a => `• *${a.data} às ${a.horario}* — ${a.servico} — R$${a.valor}`).join('\n');
    resetar(numero);
    return client.sendMessage(numero,
      `Seus agendamentos:\n\n${lista}\n\nDigite *menu* para mais opções.`
    );
  }

  return client.sendMessage(numero, 'Não entendi. Digite *menu* para ver as opções.');
}

module.exports = { processar };