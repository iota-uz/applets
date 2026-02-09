const sdkThemeExtend = require('./sdk-theme.cjs')

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  )
}

function mergeDeep(base, extra) {
  const out = { ...base }
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (isPlainObject(out[key]) && isPlainObject(value)) {
      out[key] = mergeDeep(out[key], value)
      continue
    }
    out[key] = value
  }
  return out
}

function normalizeContent(content) {
  const list = Array.isArray(content) ? content.slice() : []
  const sdkGlob = './node_modules/@iota-uz/sdk/dist/**/*.{js,mjs,cjs}'
  if (!list.includes(sdkGlob)) list.push(sdkGlob)
  return list
}

function createIotaTailwindConfig(options = {}) {
  const content = normalizeContent(options.content)
  const extend = mergeDeep(sdkThemeExtend, options.extend ?? {})
  const plugins = Array.isArray(options.plugins) ? options.plugins : []

  return {
    darkMode: 'class',
    content,
    theme: { extend },
    plugins,
  }
}

module.exports = createIotaTailwindConfig
module.exports.createIotaTailwindConfig = createIotaTailwindConfig
