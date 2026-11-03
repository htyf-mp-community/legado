const path = require('node:path');
const shim = path.resolve(__dirname, '../src/compat/navigationInteractionManager.js');

// Only adapt the pinned stack card in remote builds. Other React Native imports
// and the standalone simulator keep their original behavior.
module.exports = function navigationCompat({ types: t }) {
  return {
    name: 'htyf-navigation-interaction-manager',
    visitor: {
      ImportDeclaration(importPath, state) {
        const filename = (state.filename || '').replace(/\\/g, '/');
        if (!/\/node_modules\/@react-navigation\/stack\/(?:src|lib\/module)\/views\/Stack\/Card\.[jt]sx?$/.test(filename)) return;
        if (importPath.node.source.value !== 'react-native') return;
        const specifier = importPath.node.specifiers.find(item =>
          t.isImportSpecifier(item) && t.isIdentifier(item.imported, { name: 'InteractionManager' }),
        );
        if (!specifier) return;
        importPath.insertBefore(t.importDeclaration([t.importDefaultSpecifier(t.cloneNode(specifier.local))], t.stringLiteral(shim)));
        importPath.node.specifiers = importPath.node.specifiers.filter(item => item !== specifier);
        if (!importPath.node.specifiers.length) importPath.remove();
      },
    },
  };
};
