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

writeFileSync(
  join(targetDir, 'applet.yaml'),
  `name: ${name}
basePath: /applets/${name}
frontend:
  type: static
`,
)

writeFileSync(
  join(targetDir, 'index.ts'),
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
  join(targetDir, 'package.json'),
  JSON.stringify(
    {
      name: `@applet/${name}`,
      private: true,
      type: 'module',
      scripts: {
        dev: 'bun --hot index.ts',
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
