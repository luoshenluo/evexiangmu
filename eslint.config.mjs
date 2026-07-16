import { globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default [
  globalIgnores(['dist', '**/components/ui/**']),
  ...tseslint.configs.recommended,
]
