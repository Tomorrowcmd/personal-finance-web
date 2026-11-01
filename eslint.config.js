import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

/**
 * ESLint 扁平配置
 *
 * - js.configs.recommended：基础 JS 规则（未使用变量、未定义变量等）
 * - pluginVue flat/essential：Vue 模板与 SFC 的基础规则
 * - vueTsEslintConfig：TypeScript 规则 + Vue 解析器
 * - skipFormatting：把排版交给 Prettier，避免两套工具互相打架
 */
export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/node_modules/**'],
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig(),
  skipFormatting,

  {
    name: 'app/rules',
    rules: {
      // App.vue 是根组件，单单词命名是 Vue 官方模板惯例
      'vue/multi-word-component-names': 'off',
      // 允许 _ 前缀显式表示「不使用」（如解构时剔除分页参数）
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
]
