import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAppletStylesVirtualModulePlugin,
  VIRTUAL_APPLET_STYLES_ID,
} from './styles-plugin';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.resetAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('createAppletStylesVirtualModulePlugin', () => {
  it('fails the build when Tailwind reports a compilation error', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'applet-styles-test-'));
    temporaryDirectories.push(root);
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'index.css'), '@tailwind utilities;');

    vi.mocked(spawnSync).mockReturnValue({
      pid: 1,
      output: [],
      signal: null,
      status: 1,
      stderr: Buffer.from('CssSyntaxError: unknown utility border-default'),
      stdout: Buffer.alloc(0),
    });

    const plugin = createAppletStylesVirtualModulePlugin();
    const configure = plugin.configResolved as (config: { root: string }) => void;
    const load = plugin.load as (id: string) => string | null;
    configure({ root });

    expect(() => load(`\0${VIRTUAL_APPLET_STYLES_ID}`)).toThrow(
      /Tailwind CSS compilation failed[\s\S]*border-default/,
    );
  });
});
