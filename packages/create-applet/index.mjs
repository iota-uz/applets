#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

function fail(message) {
  console.error(message)
  process.exit(1)
}

const name = (process.argv[2] || '').trim()
if (!name) {
  fail('Usage: create-applet <name>')
}
if (!/^[a-z0-9-]+$/.test(name)) {
  fail('Applet name must contain only lowercase letters, digits, and dashes.')
}

const targetDir = resolve(process.cwd(), name)
if (existsSync(targetDir)) {
  fail(`Directory already exists: ${targetDir}`)
}

mkdirSync(targetDir, { recursive: true })
mkdirSync(join(targetDir, '.applets'), { recursive: true })
mkdirSync(join(targetDir, 'runtime'), { recursive: true })
mkdirSync(join(targetDir, 'test'), { recursive: true })

writeFileSync(
  join(targetDir, '.applets', 'config.toml'),
  `version = 2

[applets.${name}]
base_path = "/applets/${name}"

[applets.${name}.frontend]
type = "static"

[applets.${name}.engine]
runtime = "off"

[applets.${name}.engine.backends]
kv = "memory"
db = "memory"
jobs = "memory"
files = "local"
secrets = "env"
`,
)

writeFileSync(
  join(targetDir, 'runtime', 'schema.ts'),
  `import { defineSchema, defineTable, id } from '@iota-uz/sdk/applet-runtime'

export default defineSchema({
  users: defineTable({
    name: id('users'),
  }),
})
`,
)

writeFileSync(
  join(targetDir, 'runtime', 'schema.artifact.json'),
  JSON.stringify(
    {
      version: 1,
      tables: {
        users: {
          required: ['name'],
        },
      },
    },
    null,
    2,
  ) + '\n',
)

writeFileSync(
  join(targetDir, 'runtime', 'index.ts'),
  `import { defineApplet, auth } from '@iota-uz/sdk/applet-runtime'

defineApplet({
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/__health') {
      return Response.json({ ok: true, applet: '${name}' })
    }
    const user = await auth.currentUser()
    return Response.json({
      ok: true,
      applet: '${name}',
      user,
    })
  },
})
`,
)

writeFileSync(
  join(targetDir, 'test', 'runtime.test.ts'),
  `import { createTestContext } from '@iota-uz/sdk/applet-runtime'

async function main() {
  const ctx = createTestContext({ appletId: '${name}' })
  await ctx.kv.set('hello', { ok: true })
  const value = await ctx.kv.get('hello')
  if (!value || (value as { ok?: boolean }).ok !== true) {
    throw new Error('runtime test failed')
  }
  console.log('runtime test passed')
}

void main()
`,
)

writeFileSync(
  join(targetDir, 'package.json'),
  JSON.stringify(
    {
      name: `@applet/${name}`,
      private: true,
      type: 'module',
      scripts: {
        dev: 'bun --hot runtime/index.ts',
        test: 'bun test/runtime.test.ts',
      },
      dependencies: {
        '@iota-uz/sdk': '^0.4.13',
      },
    },
    null,
    2,
  ) + '\n',
)

console.log(`Created applet at ${targetDir}`)
console.log(`Next steps:`)
console.log(`  cd ${name}`)
console.log(`  bun install`)
console.log(`  bun run dev`)
