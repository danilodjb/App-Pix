const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pix } = require('faz-um-pix');
const QRCode = require('qrcode');

const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());

// Configurações
const JWT_SECRET = 'secretoseguro123';
const users = [];
const transactions = [];

// Middleware de autenticação
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

// Rotas
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

app.post('/api/generateQRCode', authenticateToken, async (req, res) => {
  const { valor, chavePix, descricao } = req.body;

  if (!valor || !chavePix) {
    return res.status(400).json({ success: false, message: 'Valor e chave Pix são obrigatórios' });
  }

  try {
    // Gerar payload EMV com faz-um-pix
    const payload = Pix(
      chavePix,
      'Danilo B.', // Nome do recebedor
      'SALVADOR',  // Cidade
      Number(valor).toFixed(2), // Valor formatado
      descricao || 'Pagamento Pix'
    );

    console.log(`✅ EMV gerado: ${payload}`);

    // Gerar QR Code
    const qrCodeImage = await QRCode.toDataURL(payload);

    // Salvar transação (em memória)
    transactions.push({
      usuario: req.user.email,
      valor,
      descricao,
      status: 'Gerado',
      dataGeracao: new Date().toISOString()
    });

    // Retornar resposta
    res.json({
      success: true,
      emv: payload,
      qrCode: qrCodeImage
    });

  } catch (error) {
    console.error('❌ Erro ao gerar QR Code:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar QR Code Pix', error: error.message });
  }
});

app.get('/api/transactionHistory', authenticateToken, (req, res) => {
  const historicoUsuario = transactions.filter(t => t.usuario === req.user.email);
  res.json({ transactions: historicoUsuario });
});

// Start
app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
