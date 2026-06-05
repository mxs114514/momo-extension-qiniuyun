const czConfig = require('./cz-git.config.cjs')

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: czConfig.rules,
}
