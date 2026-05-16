const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../data/agendamentos.json');

function carregar() {
  if (!fs.existsSync(FILE)) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function salvar(dados) {
  fs.writeFileSync(FILE, JSON.stringify(dados, null, 2));
}

module.exports = { carregar, salvar };