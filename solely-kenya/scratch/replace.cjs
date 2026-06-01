const fs = require('fs');
const path = require('path');

const replacements = [
  { file: 'src/pages/VendorRegistration.tsx', search: '90% of order value', replace: '94% of order value' },
  { file: 'src/pages/Vendor.tsx', search: '90% of order value', replace: '94% of order value' },
  { file: 'src/pages/vendor/VendorSettings.tsx', search: '90% of all your sales', replace: '94% of all your sales' },
  { file: 'src/pages/Terms.tsx', search: 'shoe marketplace', replace: 'marketplace' },
  { file: 'src/pages/Blog.tsx', search: 'shoe marketplace', replace: 'marketplace' },
  { file: 'src/data/blogPosts.ts', search: 'trusted shoe marketplace', replace: 'trusted marketplace' },
  { file: 'src/components/vendor/VendorNavbar.tsx', search: 'the shoe marketplace', replace: 'the marketplace' },
  { file: 'src/components/SEO.tsx', search: 'shoe marketplace', replace: 'marketplace', global: true },
  { file: 'src/components/SEO.tsx', search: 'Shoe Marketplace', replace: 'Marketplace', global: true },
  { file: 'src/components/ParallaxHero.tsx', search: 'Shoe Marketplace', replace: 'Marketplace' }
];

replacements.forEach(({ file, search, replace, global }) => {
  const filePath = path.join('c:\\Users\\Asaph Isweka\\Downloads\\Solely v2\\solely-kenya', file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (global) {
      content = content.split(search).join(replace);
    } else {
      content = content.replace(search, replace);
    }
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
