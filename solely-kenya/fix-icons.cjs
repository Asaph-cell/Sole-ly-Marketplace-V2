const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.tsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // We are looking for Lucide icon usages. It's hard to distinguish perfectly, but generally Capitalized tags 
  // that are imported from lucide-react.
  // Instead of parsing, a simpler regex that looks for common icon classNames:
  // className="h-4 w-4..." or className="h-5 w-5..."
  // But wait, the user wants to add strokeWidth={1.5}.
  // Let's just find imports from "lucide-react", extract the names, and then replace their usages.

  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g;
  let match;
  let icons = new Set();
  
  while ((match = importRegex.exec(content)) !== null) {
    const importedNames = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    importedNames.forEach(name => icons.add(name));
  }

  if (icons.size === 0) return;

  // For each icon found, we will replace <IconName className="...h-4 w-4..." /> with <IconName size={16} strokeWidth={1.5} className="..." />
  // This is a bit tricky with regex, but we can do a function replace.

  icons.forEach(icon => {
    // Regex to match <IconName ... />
    const iconRegex = new RegExp(`<${icon}\\s+([^>]+)>`, 'g');
    content = content.replace(iconRegex, (match, attrs) => {
      // If it already has strokeWidth, skip
      if (attrs.includes('strokeWidth')) return match;
      
      let newAttrs = attrs;
      
      // We can try to replace h-4 w-4 with size={16}
      if (/h-4\s+w-4|w-4\s+h-4/.test(newAttrs)) {
        newAttrs = newAttrs.replace(/h-4\s+w-4|w-4\s+h-4/, '').replace(/\s+className=(['"])\s+/, ' className=$1');
        newAttrs = `size={16} strokeWidth={1.5} ${newAttrs}`;
      } else if (/h-5\s+w-5|w-5\s+h-5/.test(newAttrs)) {
        newAttrs = newAttrs.replace(/h-5\s+w-5|w-5\s+h-5/, '').replace(/\s+className=(['"])\s+/, ' className=$1');
        newAttrs = `size={20} strokeWidth={1.5} ${newAttrs}`;
      } else if (/h-3\.5\s+w-3\.5|w-3\.5\s+h-3\.5/.test(newAttrs)) {
        newAttrs = newAttrs.replace(/h-3\.5\s+w-3\.5|w-3\.5\s+h-3\.5/, '').replace(/\s+className=(['"])\s+/, ' className=$1');
        newAttrs = `size={14} strokeWidth={1.5} ${newAttrs}`;
      } else if (/h-6\s+w-6|w-6\s+h-6/.test(newAttrs)) {
        newAttrs = newAttrs.replace(/h-6\s+w-6|w-6\s+h-6/, '').replace(/\s+className=(['"])\s+/, ' className=$1');
        newAttrs = `size={24} strokeWidth={1.5} ${newAttrs}`;
      } else {
        newAttrs = `strokeWidth={1.5} ${newAttrs}`;
      }

      // cleanup empty classNames
      newAttrs = newAttrs.replace(/className=(['"])\s*(['"])/, '');

      return `<${icon} ${newAttrs.trim()}>`;
    });
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

walkDir(path.join(__dirname, 'src'), processFile);
console.log('Icon updates complete.');
