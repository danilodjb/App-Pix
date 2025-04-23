const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const cors = require('cors');
const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());

const JWT_SECRET = 'secretoseguro123';
const users = [];
const transactions = [];

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token não fornecido' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
}

app.post('/api/signup', async (req, res) => {
  const { nome, email, senha } = req.body;
  const hashedPassword = await bcrypt.hash(senha, 10);
  users.push({ nome, email, senha: hashedPassword });
  res.json({ success: true, message: 'Usuário cadastrado com sucesso!' });
});

app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ message: 'Usuário não encontrado' });
  const valid = await bcrypt.compare(senha, user.senha);
  if (!valid) return res.status(403).json({ message: 'Senha incorreta' });
  const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ success: true, token });
});

app.post('/api/generateQRCode', authenticateToken, (req, res) => {
  const { valor, chavePix, descricao } = req.body;
  if (!valor || !chavePix) {
    return res.status(400).json({ success: false, message: 'Valor e chave Pix são obrigatórios' });
  }
  const agora = new Date();
  const dataFormatada = agora.toISOString().split("T")[0];
  const horaFormatada = agora.toTimeString().split(" ")[0];
  const payloadPix = {
    valor: valor,
    chave: chavePix,
    descricao: descricao || "Pagamento via QR Code",
    data: dataFormatada,
    hora: horaFormatada,
    tipo: "imediato"
  };
  QRCode.toDataURL(JSON.stringify(payloadPix), function (err, url) {
    if (err) {
      res.status(500).json({ error: 'Erro ao gerar QR Code' });
    } else {
      transactions.push({ usuario: req.user.email, valor, descricao, status: 'Recebido', dataGeracao: agora.toISOString() });
      res.json({ success: true, qrCode: url });
    }
  });
});

app.get('/api/transactionHistory', authenticateToken, (req, res) => {
  const historicoUsuario = transactions.filter(t => t.usuario === req.user.email);
  res.json({ transactions: historicoUsuario });
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
