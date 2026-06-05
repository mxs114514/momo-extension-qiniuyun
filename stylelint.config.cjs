module.exports = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['dist/**', 'playwright-report/**', 'test-results/**'],
  rules: {
    'alpha-value-notation': null,
    'at-rule-empty-line-before': null,
    'color-function-alias-notation': null,
    'color-function-notation': null,
    'custom-property-empty-line-before': null,
    'media-feature-range-notation': null,
    'rule-empty-line-before': null,
    'value-keyword-case': null,
  },
}
