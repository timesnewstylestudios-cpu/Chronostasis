import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

function tool(file, body) {
  writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  chmodSync(file, 0o755);
}

function layout(name) {
  const dir = mkdtempSync(path.join(tmpdir(), `chronostasis-${name}-`));
  const home = path.join(dir, 'home');
  const prefix = path.join(dir, 'usr');
  mkdirSync(home, { recursive: true });
  mkdirSync(path.join(prefix, 'bin'), { recursive: true });
  mkdirSync(path.join(prefix, 'lib/jvm/java-21-openjdk/bin'), { recursive: true });
  mkdirSync(path.join(prefix, 'lib/jvm/java-17-openjdk/bin'), { recursive: true });
  tool(path.join(prefix, 'lib/jvm/java-21-openjdk/bin/java'), 'echo openjdk version \\"21\\" >&2');
  tool(path.join(prefix, 'lib/jvm/java-17-openjdk/bin/java'), 'echo openjdk version \\"17\\" >&2');
  tool(path.join(prefix, 'bin/node'), 'echo v22');
  tool(path.join(prefix, 'bin/gradle'), 'echo Gradle 8');
  tool(path.join(prefix, 'bin/aapt2'), 'echo pkg-aapt2');
  return { dir, home, prefix };
}

function detect(home, prefix, extra = '') {
  const script = `
    set -euo pipefail
    source ${JSON.stringify(path.join(root, 'scripts/lib/android-env.sh'))}
    export HOME=${JSON.stringify(home)}
    export PREFIX=${JSON.stringify(prefix)}
    export PATH=${JSON.stringify(prefix ? path.join(prefix, 'bin') : '/usr/bin')}:/usr/bin:/bin
    ${extra}
    android_env_detect
    printf '%s\\n' "$ENV_KIND" "$ENV_SDK" "$ENV_AAPT2" "$ENV_JAVA_HOME" "$ENV_NODE" "$ENV_GRADLE"
  `;
  return execFileSync('bash', ['-c', script], { encoding: 'utf8' }).trim().split('\n');
}

test('Termux Studio prefers the SDK aapt2 over the pkg binary', () => {
  const { home, prefix } = layout('studio');
  mkdirSync(path.join(home, '.studio'), { recursive: true });
  const sdkAapt = path.join(home, 'android-sdk/build-tools/36.0.0/aapt2');
  mkdirSync(path.dirname(sdkAapt), { recursive: true });
  mkdirSync(path.join(home, 'android-sdk/platforms'), { recursive: true });
  tool(sdkAapt, 'echo Android Asset Packaging Tool');
  const [kind, sdk, aapt2, javaHome, node, gradle] = detect(home, prefix);
  assert.equal(kind, 'Termux Studio');
  assert.equal(sdk, path.join(home, 'android-sdk'));
  assert.equal(aapt2, sdkAapt);
  assert.equal(javaHome, path.join(prefix, 'lib/jvm/java-21-openjdk'));
  assert.equal(node, path.join(prefix, 'bin/node'));
  assert.equal(gradle, path.join(prefix, 'bin/gradle'));
});

test('Termux Studio reads aapt2 and the JDK from ~/.gradle/gradle.properties', () => {
  const { home, prefix } = layout('props');
  writeFileSync(path.join(home, 'termux_studio.py'), '# marker\n');
  const customAapt = path.join(home, 'custom/aapt2');
  const customJdk = path.join(home, 'jdk');
  mkdirSync(path.dirname(customAapt), { recursive: true });
  mkdirSync(path.join(customJdk, 'bin'), { recursive: true });
  mkdirSync(path.join(home, 'android-sdk/platforms'), { recursive: true });
  tool(customAapt, 'echo custom');
  tool(path.join(customJdk, 'bin/java'), 'echo custom-jdk >&2');
  mkdirSync(path.join(home, '.gradle'), { recursive: true });
  writeFileSync(
    path.join(home, '.gradle/gradle.properties'),
    `android.aapt2FromMavenOverride=${customAapt}\norg.gradle.java.home=${customJdk}\n`,
  );
  const [kind, , aapt2, javaHome] = detect(home, prefix);
  assert.equal(kind, 'Termux Studio');
  assert.equal(aapt2, customAapt);
  assert.equal(javaHome, customJdk);
});

test('plain Termux uses the package aapt2 and then an env SDK', () => {
  const { home, prefix } = layout('plain');
  const envSdk = path.join(home, 'elsewhere/sdk');
  mkdirSync(path.join(envSdk, 'cmdline-tools'), { recursive: true });
  const [kind, sdk, aapt2] = detect(home, prefix, `export ANDROID_HOME=${JSON.stringify(envSdk)}`);
  assert.equal(kind, 'Termux');
  assert.equal(sdk, envSdk);
  assert.equal(aapt2, path.join(prefix, 'bin/aapt2'));
});

test('without a Termux prefix, ANDROID_HOME and JAVA_HOME are the fallback', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chronostasis-env-'));
  const sdk = path.join(dir, 'sdk');
  const jdk = path.join(dir, 'jdk');
  const aapt = path.join(dir, 'aapt2');
  mkdirSync(path.join(sdk, 'build-tools'), { recursive: true });
  mkdirSync(path.join(jdk, 'bin'), { recursive: true });
  tool(aapt, 'echo env-aapt2');
  tool(path.join(jdk, 'bin/java'), 'echo env-java >&2');
  const [kind, foundSdk, foundAapt, foundJava] = detect(
    path.join(dir, 'empty-home'),
    '',
    `export HOME=${JSON.stringify(path.join(dir, 'empty-home'))}
     mkdir -p "$HOME"
     export ANDROID_SDK_ROOT=${JSON.stringify(sdk)}
     export JAVA_HOME=${JSON.stringify(jdk)}
     export AAPT2=${JSON.stringify(aapt)}`,
  );
  assert.equal(kind, 'Umgebungsvariablen');
  assert.equal(foundSdk, sdk);
  assert.equal(foundAapt, aapt);
  assert.equal(foundJava, jdk);
});
