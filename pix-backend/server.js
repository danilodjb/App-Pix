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
app.post('/api/generateQRCode', authenticateToken, async (req, res) => {
  const { valor, chavePix, descricao } = req.body;

  if (!valor || !chavePix) {
    return res.status(400).json({ success: false, message: 'Valor e chave Pix são obrigatórios' });
  }

  try {
    const pix = Pix(
      chavePix,
      'Danilo B.',
      'SALVADOR',
      Number(valor).toFixed(2),
      descricao || 'Pagamento Pix'
    );
    const payload = pix.getPayload(); // CORRETO

    console.log(`✅ EMV gerado: ${payload}`);

    const qrCodeImage = await QRCode.toDataURL(payload);

    transactions.push({
      usuario: req.user.email,
      valor,
      descricao,
      status: 'Gerado',
      dataGeracao: new Date().toISOString()
    });

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
