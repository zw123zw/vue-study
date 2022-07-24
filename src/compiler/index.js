/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
// 模板编译就是把模板转化成供Vue实例在挂载时可调用的render函数
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {

  const ast = parse(template.trim(), options)  // 模板解析阶段-解析器，将一堆模板字符串用正则等方式解析成抽象语法树AST
  if (options.optimize !== false) {
    optimize(ast, options)  //模板优化阶段-优化器，遍历AST，找出其中的静态节点，并打上标记
  }
  const code = generate(ast, options) // 代码生成阶段-代码生成器，生成reader函数中的内容
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns  // 静态渲染函数
  }
})
