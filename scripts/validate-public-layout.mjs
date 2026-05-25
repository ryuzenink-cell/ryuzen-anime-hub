import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const blogHtml = read('blog/index.html');
const css = read('assets/css/public-ui.css');
const ui = read('assets/js/ui.js');

expect(blogHtml.includes('data-public-layout="blog-index"'), 'A home do blog deve declarar data-public-layout="blog-index".');
expect(blogHtml.includes('class="public-site blog-index-page"'), 'A home do blog deve manter a classe blog-index-page.');
expect(!/\.public-site\s+\.page-hero\s*\{[^}]*max-width\s*:/s.test(css), 'Não limite a seção .page-hero global; isso corta o canvas do blog.');
expect(css.includes('.public-site.blog-index-page .blog-hero-grid'), 'O layout da home do blog precisa de grid escopado.');
expect(css.includes('.public-site.blog-index-page .promo-sidebars'), 'A home do blog precisa de fallback CSS que impeça rails promocionais.');
expect(ui.includes('document.body.dataset.publicLayout === "blog-index"'), 'renderPromoSidebars deve ignorar explicitamente a home do blog.');

if (failures.length) {
  console.error('\nFalha na validação de layout público:');
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log('Layout público validado: blog landing sem rail/banner e sem restrição indevida do hero.');
