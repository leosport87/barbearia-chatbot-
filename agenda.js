const { carregar, salvar } = require('./storage');
const path = require('path');
const fs = require('fs');

const BLOQUEIOS_FILE = path.join(__dirname, '../data/bloqueios.json');
const TOLERANCIA = 10;

const SERVICOS = {
  '1':  { nome: 'Sobrancelha',                                      duracao: 5,   valor: 5   },
  '2':  { nome: 'Cantinho',                                          duracao: 5,   valor: 10  },
  '3':  { nome: 'Pigmentação',                                       duracao: 25,  valor: 15  },
  '4':  { nome: 'Limpeza facial',                                    duracao: 25,  valor: 25  },
  '5':  { nome: 'Barba',                                             duracao: 25,  valor: 25  },
  '6':  { nome: 'Barba terapia',                                     duracao: 30,  valor: 30  },
  '7':  { nome: 'Corte',                                             duracao: 45,  valor: 30  },
  '8':  { nome: 'Corte infantil',                                    duracao: 60,  valor: 30  },
  '9':  { nome: 'Corte + sobrancelha',                               duracao: 45,  valor: 35  },
  '10': { nome: 'Corte + limpeza facial',                            duracao: 60,  valor: 45  },
  '11': { nome: 'Corte + barba',                                     duracao: 60,  valor: 45  },
  '12': { nome: 'Corte + barba terapia',                             duracao: 80,  valor: 50  },
  '13': { nome: 'Corte + limpeza facial + barba terapia',            duracao: 90,  valor: 65  },
};

Object.values(SERVICOS).forEach(s => {
  s.slots = Math.ceil(s.duracao / 15);
});

function getBloqueios() {
  if (!fs.existsSync(BLOQUEIOS_FILE)) {
    fs.writeFileSync(BLOQUEIOS_FILE, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(BLOQUEIOS_FILE, 'utf8'));
}

function gerarSlots() {
  const slots = [];
  for (let h = 9; h < 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      const totalMin = h * 60 + m;
      if (totalMin >= 12 * 60 && totalMin < 13 * 60 + 30) continue;
      const hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(hora);
    }
  }
  return slots;
}

function horaParaMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function minutosParaHora(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatarDuracao(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}min`;
}

function getHoje() {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function getProximosDias() {
  const dias = [];
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  let count = 0;
  let i = 0;
  while (count < 5) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    i++;
    if (d.getDay() === 0) continue;
    const dataStr = d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const bloqueio = isDiaBloqueado(dataStr);
    if (bloqueio === 'dia inteiro') continue;
    const label = count === 0 ? 'Hoje' : count === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    dias.push({ dataStr, label });
    count++;
  }
  return dias;
}

function isDiaBloqueado(dataStr) {
  const bloqueios = getBloqueios();
  const [dia, mes, ano] = dataStr.split('/');
  const diaSemana = new Date(`${ano}-${mes}-${dia}T12:00:00`).getDay();
  if (diaSemana === 0) return 'dia inteiro';
  return bloqueios[dataStr] || null;
}

function isSlotBloqueado(hora, bloqueio) {
  if (!bloqueio) return false;
  if (bloqueio === 'dia inteiro') return true;
  const min = horaParaMinutos(hora);
  if (bloqueio === 'manha' && min < 12 * 60) return true;
  if (bloqueio === 'tarde' && min >= 13 * 60) return true;
  return false;
}

function getHorariosLivres(slotsNecessarios, dataStr) {
  const bloqueio = isDiaBloqueado(dataStr);
  if (bloqueio === 'dia inteiro') return [];

  const dados = carregar();
  const agora = new Date();
  const hoje = getHoje();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const ehHoje = dataStr === hoje;

  const todosSlots = gerarSlots();
  const slotsOcupados = new Set();

  Object.values(dados).forEach(a => {
    if (a.data !== dataStr) return;
    for (let i = 0; i < a.slots; i++) {
      const min = horaParaMinutos(a.horario) + i * 15;
      slotsOcupados.add(minutosParaHora(min));
    }
  });

  const livres = [];

  for (let i = 0; i <= todosSlots.length - slotsNecessarios; i++) {
    const slotInicio = todosSlots[i];
    const minInicio = horaParaMinutos(slotInicio);

    if (ehHoje && minInicio <= agoraMin) continue;
    if (isSlotBloqueado(slotInicio, bloqueio)) continue;

    let cabe = true;
    for (let j = 0; j < slotsNecessarios; j++) {
      const minSlot = minInicio + j * 15;
      const horaSlot = minutosParaHora(minSlot);

      if (!todosSlots.includes(horaSlot)) { cabe = false; break; }
      if (slotsOcupados.has(horaSlot)) { cabe = false; break; }
      if (isSlotBloqueado(horaSlot, bloqueio)) { cabe = false; break; }
      if (minSlot >= 12 * 60 && minSlot < 13 * 60 + 30) { cabe = false; break; }
    }

    if (cabe) livres.push(slotInicio);
  }

  return livres;
}

function agendar(numero, horario, data, nome, servico) {
  const dados = carregar();
  dados[`${numero}_${data}_${horario}`] = {
    numero,
    nome,
    servico: servico.nome,
    duracao: servico.duracao,
    valor: servico.valor,
    slots: servico.slots,
    horario,
    data,
    criadoEm: new Date().toISOString(),
  };
  salvar(dados);
}

function cancelar(id) {
  const dados = carregar();
  delete dados[id];
  salvar(dados);
}

function getAgendamentosCliente(numero) {
  const dados = carregar();
  const hoje = getHoje();
  return Object.entries(dados)
    .filter(([, a]) => a.numero === numero && a.data >= hoje)
    .map(([id, a]) => ({ id, ...a }))
    .sort((a, b) => {
      if (a.data !== b.data) return a.data.split('/').reverse().join('').localeCompare(b.data.split('/').reverse().join(''));
      return a.horario.localeCompare(b.horario);
    });
}

function getAgendamentosProxima1h() {
  const dados = carregar();
  const agora = new Date();
  const em1h = new Date(agora.getTime() + 60 * 60 * 1000);
  const hoje = getHoje();

  return Object.entries(dados)
    .filter(([, a]) => {
      if (a.data !== hoje) return false;
      const [h, m] = a.horario.split(':').map(Number);
      const dt = new Date();
      dt.setHours(h, m, 0, 0);
      return dt >= agora && dt <= em1h;
    })
    .map(([id, a]) => ({ id, ...a }));
}

module.exports = {
  SERVICOS,
  TOLERANCIA,
  formatarDuracao,
  getHorariosLivres,
  getProximosDias,
  agendar,
  cancelar,
  getAgendamentosCliente,
  getAgendamentosProxima1h,
  getHoje,
  isDiaBloqueado,
};