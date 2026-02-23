const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function directoryExists(dirPath) {
  try {
    return Boolean(dirPath) && fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(filePath) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function uniqueSorted(items) {
  return Array.from(new Set(items.filter(Boolean))).sort();
}

function normalizeRootDir(rootDir) {
  if (!rootDir || typeof rootDir !== "string") {
    return process.cwd();
  }
  return path.resolve(rootDir);
}

function resolveGoModCacheDir(env) {
  if (env.GOMODCACHE) {
    return env.GOMODCACHE;
  }
  if (env.GOPATH) {
    return path.join(env.GOPATH, "pkg", "mod");
  }
  return "";
}

function resolveGoListModuleDir(rootDir, execSyncFn, env) {
  if (!fileExists(path.join(rootDir, "go.mod"))) {
    return "";
  }
  try {
    return execSyncFn("go list -m -f '{{.Dir}}' github.com/iota-uz/iota-sdk", {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...env, GOWORK: "off" },
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

function defaultMonorepoCandidates(rootDir) {
  return [
    path.resolve(rootDir, "..", "iota-sdk"),
    path.resolve(rootDir, "..", "..", "iota-sdk"),
    path.resolve(rootDir, "..", "..", "..", "iota-sdk"),
  ];
}

function sdkTemplateGlobsFromDir(sdkDir) {
  return [
    path.join(sdkDir, "modules", "**", "templates", "**", "*.{html,js,templ}"),
    path.join(sdkDir, "components", "**", "*.{html,js,templ,go}"),
  ];
}

function sdkTemplateGlobsFromGoModCache(goModCacheDir) {
  return [
    path.join(
      goModCacheDir,
      "github.com",
      "iota-uz",
      "iota-sdk@*",
      "modules",
      "**",
      "templates",
      "**",
      "*.{html,js,templ}"
    ),
    path.join(
      goModCacheDir,
      "github.com",
      "iota-uz",
      "iota-sdk@*",
      "components",
      "**",
      "*.{html,js,templ,go}"
    ),
  ];
}

function resolveIotaSdkTailwindContentWithDebug(options = {}) {
  const rootDir = normalizeRootDir(options.rootDir);
  const env = { ...process.env, ...(options.env ?? {}) };
  const execSyncFn = options.execSyncFn ?? execSync;
  const includeGoList = options.includeGoList !== false;
  const includeMonorepoFallback = options.includeMonorepoFallback !== false;
  const includeGoModCache = options.includeGoModCache !== false;

  const sources = {
    rootDir,
    goListModuleDir: "",
    monorepoCandidateDirs: [],
    goModCacheDir: "",
  };

  const sdkDirs = [];

  if (typeof options.goListModuleDir === "string" && options.goListModuleDir.trim() !== "") {
    sources.goListModuleDir = path.resolve(options.goListModuleDir);
  } else if (includeGoList) {
    sources.goListModuleDir = resolveGoListModuleDir(rootDir, execSyncFn, env);
  }
  if (directoryExists(sources.goListModuleDir)) {
    sdkDirs.push(path.resolve(sources.goListModuleDir));
  }

  if (includeMonorepoFallback) {
    const rawMonorepoCandidates = Array.isArray(options.monorepoCandidates) && options.monorepoCandidates.length > 0
      ? options.monorepoCandidates
      : defaultMonorepoCandidates(rootDir);
    for (const candidate of rawMonorepoCandidates) {
      if (!candidate || typeof candidate !== "string") {
        continue;
      }
      const absCandidate = path.resolve(candidate);
      if (directoryExists(absCandidate)) {
        sources.monorepoCandidateDirs.push(absCandidate);
        sdkDirs.push(absCandidate);
      }
    }
  }

  if (includeGoModCache) {
    const rawGoModCacheDir = typeof options.goModCacheDir === "string" && options.goModCacheDir.trim() !== ""
      ? options.goModCacheDir
      : resolveGoModCacheDir(env);
    if (directoryExists(rawGoModCacheDir)) {
      sources.goModCacheDir = path.resolve(rawGoModCacheDir);
    }
  }

  const content = [];
  for (const sdkDir of uniqueSorted(sdkDirs)) {
    content.push(...sdkTemplateGlobsFromDir(sdkDir));
  }
  if (
    sources.goModCacheDir &&
    directoryExists(path.join(sources.goModCacheDir, "github.com", "iota-uz"))
  ) {
    content.push(...sdkTemplateGlobsFromGoModCache(sources.goModCacheDir));
  }

  return {
    content: uniqueSorted(content),
    sources: {
      ...sources,
      monorepoCandidateDirs: uniqueSorted(sources.monorepoCandidateDirs),
    },
  };
}

function resolveIotaSdkTailwindContent(options = {}) {
  return resolveIotaSdkTailwindContentWithDebug(options).content;
}

module.exports = {
  resolveIotaSdkTailwindContent,
  resolveIotaSdkTailwindContentWithDebug,
};
