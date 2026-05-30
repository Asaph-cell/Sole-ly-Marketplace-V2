const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminDisputes.bak2.tsx', 'utf-8');

// Replace imports
code = code.replace(/import \{ VendorNavbar \} from .*?;/, 'import { AdminLayout } from "@/components/admin/AdminLayout";');

// Replace wrapper
code = code.replace(/<div className="min-h-screen bg-muted\/30 pb-20">\s*<VendorNavbar \/>\s*<main className="container max-w-6xl mx-auto p-4 pt-8">/, '<AdminLayout pageTitle="Resolution Center">');
code = code.replace(/<\/main>\s*<\/div>/, '</AdminLayout>');

fs.writeFileSync('src/pages/admin/AdminDisputes.tsx', code);
console.log("Patched successfully!");
