// eslint-disable-next-line no-undef
module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:@typescript-eslint/recommended'],
    plugins: ['react', '@typescript-eslint', 'react-hooks'],
    rules: {
        'react/react-in-jsx-scope': 'off',
        'react-hooks/exhaustive-deps': 'error',
        'react/no-unescaped-entities': 'off',
    },
}
