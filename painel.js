const http = require('http');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../data/agendamentos.json');
const BLOQUEIOS_FILE = path.join(__dirname, '../data/bloqueios.json');

const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Allyson Barbearia - Painel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: sans-serif; background: #f5f5f5; padding: 24px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 22px; color: #222; }
    .sub { font-size: 13px; color: #888; margin-bottom: 24px; }
    h2 { font-size: 16px; margin: 24px 0 12px; color: #222; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 32px; }
    th { background: #222; color: #fff; padding: 12px 16px; text-align: left; font-size: 13px; }
    td { padding: 12px 16px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fafafa; }
    .vazio { text-align: center; padding: 32px; color: #999; font-size: 14px; }
    .bloqueio-form { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 32px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .bloqueio-form input, .bloqueio-form select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
    .bloqueio-form button { padding: 8px 16px; background: #222; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
    .btn-remover { padding: 6px 12px; background: #c0392b; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
    .manha { background: #fff3cd; color: #856404; }
    .tarde { background: #cce5ff; color: #004085; }
    .dia { background: #f8d7da; color: #721c24; }
    .total { font-size: 13px; color: #555; margin-bottom: 8px; }
    .tag-hoje { background: #222; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 10px; margin-left: 6px; }
    .tag-futuro { background: #0d6efd; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 10px; margin-left: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Allyson Barbearia Studio Tattoo</h1>
  </div>
  <p class="sub" id="data-hoje"></p>

  <h2>Agendamentos</h2>
  <p class="total" id="total-geral"></p>
  <table>
    <thead>
      <tr><th>Data</th><th>Horário</th><th>Nome</th><th>Serviço</th><th>Valor</th><th>Telefone</th><th>Agendado às</th></tr>
    </thead>
    <tbody id="tbody-agendamentos"></tbody>
  </table>

  <h2>Bloquear dia / período</h2>
  <div class="bloqueio-form">
    <input type="date" id="data-bloqueio">
    <select id="tipo-bloqueio">
      <option value="dia inteiro">Dia inteiro</option>
      <option value="manha">Somente manhã</option>
      <option value="tarde">Somente tarde</option>
    </select>
    <button onclick="adicionarBloqueio()">Bloquear</button>
  </div>
  <table>
    <thead>
      <tr><th>Data</th><th>Tipo</th><th>Ação</th></tr>
    </thead>
    <tbody id="tbody-bloqueios"></tbody>
  </table>

  <script>
    const hoje = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    });

    document.getElementById('data-hoje').textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });

    function formatarTelefone(numero) {
      const n = numero.replace('@c.us', '').replace('@lid', '');
      if (n.length === 13) return '+' + n.slice(0,2) + ' (' + n.slice(2,4) + ') ' + n.slice(4,9) + '-' + n.slice(9);
      if (n.length === 12) return '+' + n.slice(0,2) + ' (' + n.slice(2,4) + ') ' + n.slice(4,8) + '-' + n.slice(8);
      return n;
    }

    function dataParaOrdem(dataStr) {
      if (!dataStr) return '';
      const p = dataStr.split('/');
      if (p.length !== 3) return dataStr;
      return p[2] + p[1] + p[0];
    }

    async function carregar() {
      try {
        const [ag, bl] = await Promise.all([
          fetch('/dados').then(r => r.json()),
          fetch('/bloqueios').then(r => r.json())
        ]);

        console.log('Agendamentos recebidos:', ag);

        const lista = Object.values(ag)
  .filter(a => a.data && a.horario && dataParaOrdem(a.data) >= dataParaOrdem(hoje))
          .sort((a, b) => {
            const d = dataParaOrdem(a.data).localeCompare(dataParaOrdem(b.data));
            return d !== 0 ? d : a.horario.localeCompare(b.horario);
          });

        console.log('Lista filtrada:', lista.length, 'itens');

        const totalHoje = lista.filter(a => a.data === hoje).reduce((s, a) => s + (a.valor || 0), 0);
        const countHoje = lista.filter(a => a.data === hoje).length;
        const countFuturo = lista.filter(a => a.data !== hoje).length;

        document.getElementById('total-geral').textContent =
          'Hoje: ' + countHoje + ' agendamento(s) · R$' + totalHoje +
          (countFuturo > 0 ? ' · Próximos dias: ' + countFuturo + ' agendamento(s)' : '');

        const tbodyAg = document.getElementById('tbody-agendamentos');
        tbodyAg.innerHTML = lista.length === 0
          ? '<tr><td colspan="7" class="vazio">Nenhum agendamento.</td></tr>'
          : lista.map(a => {
              const tag = a.data === hoje
                ? '<span class="tag-hoje">Hoje</span>'
                : '<span class="tag-futuro">Agendado</span>';
              return '<tr>' +
                '<td><b>' + a.data + '</b>' + tag + '</td>' +
                '<td><b>' + a.horario + '</b></td>' +
                '<td>' + a.nome + '</td>' +
                '<td>' + (a.servico || '—') + '</td>' +
                '<td>R$' + (a.valor || '—') + '</td>' +
                '<td>' + formatarTelefone(a.numero) + '</td>' +
                '<td>' + new Date(a.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</td>' +
              '</tr>';
            }).join('');

        const tbodyBl = document.getElementById('tbody-bloqueios');
        const blEntries = Object.entries(bl).sort();
        tbodyBl.innerHTML = blEntries.length === 0
          ? '<tr><td colspan="3" class="vazio">Nenhum bloqueio cadastrado.</td></tr>'
          : blEntries.map(function(entry) {
              const data = entry[0];
              const tipo = entry[1];
              const cls = tipo === 'dia inteiro' ? 'dia' : tipo === 'manha' ? 'manha' : 'tarde';
              const label = tipo === 'dia inteiro' ? 'Dia inteiro' : tipo === 'manha' ? 'Manhã' : 'Tarde';
              return '<tr>' +
                '<td>' + data + '</td>' +
                '<td><span class="badge ' + cls + '">' + label + '</span></td>' +
                '<td><button class="btn-remover" onclick="removerBloqueio(this.dataset.data)" data-data="' + data + '">Remover</button></td>' +
              '</tr>';
            }).join('');

      } catch(err) {
        console.error('Erro ao carregar dados:', err);
      }
    }

    async function adicionarBloqueio() {
      const data = document.getElementById('data-bloqueio').value;
      const tipo = document.getElementById('tipo-bloqueio').value;
      if (!data) return alert('Selecione uma data.');
      await fetch('/bloqueios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, tipo })
      });
      carregar();
    }

    async function removerBloqueio(data) {
      await fetch('/bloqueios/' + data, { method: 'DELETE' });
      carregar();
    }

    carregar();
    setInterval(carregar, 10000);
  </script>
</body>
</html>`;

function iniciarPainel(porta = 3000) {
  const server = http.createServer((req, res) => {
    if (req.url === '/dados') {
      const dados = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(dados));
    }

    if (req.url === '/bloqueios' && req.method === 'GET') {
      const dados = fs.existsSync(BLOQUEIOS_FILE) ? JSON.parse(fs.readFileSync(BLOQUEIOS_FILE, 'utf8')) : {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(dados));
    }

    if (req.url === '/bloqueios' && req.method === 'POST') {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        const { data, tipo } = JSON.parse(body);
        const dados = fs.existsSync(BLOQUEIOS_FILE) ? JSON.parse(fs.readFileSync(BLOQUEIOS_FILE, 'utf8')) : {};
        dados[data] = tipo;
        fs.writeFileSync(BLOQUEIOS_FILE, JSON.stringify(dados, null, 2));
        res.writeHead(200);
        res.end('ok');
      });
      return;
    }

    if (req.url.startsWith('/bloqueios/') && req.method === 'DELETE') {
      const data = req.url.replace('/bloqueios/', '');
      const dados = fs.existsSync(BLOQUEIOS_FILE) ? JSON.parse(fs.readFileSync(BLOQUEIOS_FILE, 'utf8')) : {};
      delete dados[data];
      fs.writeFileSync(BLOQUEIOS_FILE, JSON.stringify(dados, null, 2));
      res.writeHead(200);
      return res.end('ok');
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  });

  server.listen(porta, () => {
    console.log(`Painel disponível em http://localhost:${porta}`);
  });
}

module.exports = { iniciarPainel };