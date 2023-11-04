import { defineCommand } from 'citty'
import { join, relative, resolve } from 'pathe'
import { consola } from 'consola'
// import { provider } from 'std-env'
// import { commands } from './commands'
import pkg from '../package.json' assert { type: 'json' }
import { loadKit } from './utils/kit'
import { tryResolveModule } from './utils/esm'
import { clearBuildDir } from './utils/fs'

export const main = defineCommand({
  meta: {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Current working directory',
    },
    rootDir: {
      type: 'positional',
      description: 'Root Directory',
      required: false,
    },
  },
  async setup(ctx) {
    const cwd = resolve(ctx.args.cwd || ctx.args.rootDir || '.')
    const { loadNuxt, buildNuxt, writeTypes, installModule } = await loadKit(
      cwd
    )
    const nuxt = await loadNuxt({
      rootDir: cwd,
      defaultConfig: {
        modules:[
          async (options, nuxt) => {
            const localMeta = await tryResolveModule('nuxt-component-meta', cwd)
            if (!localMeta) {
              const internalMeta = await tryResolveModule('nuxt-component-meta')
              if (internalMeta) {
                installModule(internalMeta, {
                  globalsOnly: false,
                  debug: 2,
                  exclude: [(component: any) => {
                    return !component.filePath?.startsWith?.(join(cwd, 'components'))
                  }],
                  checkerOptions: {
                    forceUseTs: true,
                    printer: { newLine: 1 },
                    schema: {
                      ignore: [
                        'RouteLocationRaw',
                        'ComponentData',
                        'NuxtComponentMetaNames',
                        'RouteLocationPathRaw',
                        'RouteLocationNamedRaw',
                      ],
                    },
                  },
                })
              }
            }
          },
        ],
      },
      overrides: {
        _generate: true,
        logLevel: ctx.args.logLevel as 'silent' | 'info' | 'verbose',
        ...ctx.data?.overrides,
      },
    })
    await clearBuildDir(nuxt.options.buildDir)
    await buildNuxt(nuxt)
    await writeTypes(nuxt)
    consola.success(
      'Types generated in',
      relative(process.cwd(), nuxt.options.buildDir),
    )
  },
}) as any /* TODO: Fix rollup type inline issue */
