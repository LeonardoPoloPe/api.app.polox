const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/controllers/ProductController.js');
let content = fs.readFileSync(filePath, 'utf8');

// Substituições necessárias
const replacements = [
  { from: /'SELECT \* FROM products WHERE/g, to: "'SELECT * FROM polox.products WHERE" },
  { from: /'SELECT id FROM products WHERE/g, to: "'SELECT id FROM polox.products WHERE" },
  { from: /'SELECT COUNT\(\*\) as count FROM sale_items/g, to: "'SELECT COUNT(*) as count FROM polox.sale_items" },
  { from: /INNER JOIN sales s/g, to: 'INNER JOIN polox.sales s' },
  { from: /'UPDATE products SET/g, to: "'UPDATE polox.products SET" },
  { from: /SELECT \* FROM products /g, to: 'SELECT * FROM polox.products ' },
  { from: /'UPDATE products SET current_stock/g, to: "'UPDATE polox.products SET current_stock" },
  { from: /FROM products p$/gm, to: 'FROM polox.products p' },
  { from: /FROM product_categories pc$/gm, to: 'FROM polox.product_categories pc' },
  { from: /'SELECT id FROM product_categories WHERE/g, to: "'SELECT id FROM polox.product_categories WHERE" },
  { from: /FROM stock_movements sm/g, to: 'FROM polox.stock_movements sm' },
  { from: /FROM stock_movements sm1/g, to: 'FROM polox.stock_movements sm1' },
  { from: /FROM stock_movements sm2/g, to: 'FROM polox.stock_movements sm2' },
  { from: /LEFT JOIN products p /g, to: 'LEFT JOIN polox.products p ' },
  { from: /INSERT INTO stock_movements/g, to: 'INSERT INTO polox.stock_movements' },
  { from: /INSERT INTO product_categories/g, to: 'INSERT INTO polox.product_categories' },
  { from: /UPDATE user_gamification_profiles/g, to: 'UPDATE polox.user_gamification_profiles' },
  { from: /INSERT INTO gamification_history/g, to: 'INSERT INTO polox.gamification_history' },
  { from: /INSERT INTO audit_logs/g, to: 'INSERT INTO polox.audit_logs' },
];

replacements.forEach(({ from, to }) => {
  content = content.replace(from, to);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Arquivo corrigido com sucesso!');
