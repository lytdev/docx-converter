import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const normalize = (path: string) => path.replace(/\\/g, '/');
const foundations = ['contracts', 'domain', 'shared'];
const layers = [...foundations, 'application', 'infrastructure', 'modules', 'rendering', 'adapters'];
const nodeModules = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
const layer = (path: string) => path.split('/')[1];

/** Both runtime and type imports must respect the same boundaries. */
export function dependencyAllowed(from: string, to: string): boolean {
  if (from.startsWith('apps/')) return to.startsWith('apps/') || ['src/index.ts', 'src/browser-metafile.ts'].includes(to);
  if (from === 'src/index.ts') return to === 'src/application/convert-docx.ts' || layer(to) === 'contracts';
  if (from === 'src/node.ts') return to === 'src/index.ts' || to.startsWith('src/adapters/node/');
  if (from === 'src/browser-metafile.ts') return to.startsWith('src/adapters/browser/');
  if (!to.startsWith('src/') || !layers.includes(layer(from)) || !layers.includes(layer(to))) return false;
  const a = layer(from), b = layer(to);
  if (foundations.includes(a)) return a === b;
  if (foundations.includes(b)) return true;
  if (a === 'infrastructure') return b === 'infrastructure';
  if (a === 'application') return ['application', 'infrastructure', 'modules', 'rendering'].includes(b);
  if (a === 'adapters') return b === 'application' || (b === 'adapters' && from.split('/')[2] === to.split('/')[2]);
  if (a === 'rendering') return b === 'rendering' || to.startsWith('src/modules/images/');
  if (a === 'modules') {
    if (b === 'infrastructure') return !from.startsWith('src/modules/images/');
    if (b !== 'modules') return false;
    const feature = from.split('/')[2], target = to.split('/')[2];
    return feature === target || feature === 'document' && ['styles', 'numbering', 'math'].includes(target);
  }
  return false;
}

export function findCycles(graph: Map<string, string[]>): string[] {
  const visited = new Set<string>(), active: string[] = [], cycles: string[] = [];
  function visit(file: string): void {
    const index = active.indexOf(file);
    if (index >= 0) { cycles.push([...active.slice(index), file].join(' → ')); return; }
    if (visited.has(file)) return;
    visited.add(file); active.push(file);
    for (const target of graph.get(file) ?? []) visit(target);
    active.pop();
  }
  for (const file of graph.keys()) visit(file);
  return cycles;
}

export function checkArchitecture(root: string): { files: number; errors: string[] } {
  const files: string[] = [], errors: string[] = [], graph = new Map<string, string[]>();
  function walk(directory: string): void {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) files.push(path);
    }
  }
  walk('src'); walk('apps');
  const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
  for (const file of files) {
    if (file.startsWith('src/') && !['src/index.ts', 'src/node.ts', 'src/browser-metafile.ts'].includes(file) && !layers.includes(layer(file))) errors.push(`${file}: 未声明的源码层`);
    const dependencies: string[] = [];
    graph.set(file, dependencies);
    const absolute = resolve(root, file);
    const source = ts.createSourceFile(file, readFileSync(absolute, 'utf8'), ts.ScriptTarget.Latest, true);
    function dependency(specifier: string): void {
      if (specifier.endsWith('.css') && file.startsWith('apps/')) return;
      const resolved = ts.resolveModuleName(specifier, absolute, options, ts.sys).resolvedModule;
      if (!resolved) { errors.push(`${file}: 无法解析 ${specifier}`); return; }
      if (resolved.isExternalLibraryImport) {
        if (foundations.includes(layer(file))) errors.push(`${file}: 基础层不允许依赖 ${specifier}`);
        return;
      }
      const target = normalize(relative(root, resolved.resolvedFileName));
      dependencies.push(target);
      if (!dependencyAllowed(file, target)) errors.push(`${file} → ${target}: 违反依赖边界`);
    }
    function moduleReference(specifier: string): void {
      if (nodeModules.has(specifier.replace(/^node:/, '')) || specifier.startsWith('node:')) {
        if (!file.startsWith('src/adapters/node/')) errors.push(`${file}: Node API 只能位于 Node 适配器 (${specifier})`);
        return;
      }
      dependency(specifier);
    }
    function visit(node: ts.Node): void {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) moduleReference(node.moduleSpecifier.text);
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) moduleReference(node.argument.literal.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) moduleReference(argument.text);
        else errors.push(`${file}: 不允许无法静态分析的模块加载`);
      }
      // Vite resolves worker entries through new URL('./entry.ts', import.meta.url).
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL') {
        const argument = node.arguments?.[0];
        if (argument && ts.isStringLiteral(argument) && argument.text.endsWith('.ts')) dependency(argument.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  errors.push(...findCycles(graph).map(cycle => `循环依赖: ${cycle}`));
  return { files: files.length, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = checkArchitecture(root);
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else console.log(`Architecture OK: ${result.files} source files; no forbidden imports or cycles.`);
}
