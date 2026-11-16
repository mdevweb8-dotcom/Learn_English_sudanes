import fs from 'node:fs';
import path from 'node:path';

const errors = [];
const warnings = [];

const pkgPath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

const nonPluginCapPackages = new Set(['@capacitor/core', '@capacitor/cli', '@capacitor/android']);
const expectedCapPlugins = Object.keys(allDeps).filter(
  (name) => name.startsWith('@capacitor/') && !nonPluginCapPackages.has(name),
);

const settingsGradlePath = path.resolve('android/settings.gradle');
const capSettingsPath = path.resolve('android/capacitor.settings.gradle');
const variablesGradlePath = path.resolve('android/variables.gradle');
const appBuildGradlePath = path.resolve('android/app/build.gradle');
const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(settingsGradlePath)) {
  errors.push('Missing android/settings.gradle');
} else {
  const settingsContent = fs.readFileSync(settingsGradlePath, 'utf8');
  const capSettingsContent = fs.existsSync(capSettingsPath) ? fs.readFileSync(capSettingsPath, 'utf8') : '';
  const combinedSettings = `${settingsContent}\n${capSettingsContent}`;

  if (!combinedSettings.includes("':capacitor-android'") && !combinedSettings.includes('":capacitor-android"')) {
    errors.push('android/settings.gradle (or capacitor.settings.gradle) is missing :capacitor-android');
  }

  for (const plugin of expectedCapPlugins) {
    const slug = plugin.replace('@', '').replace('/', '-');
    const dirPattern = new RegExp(`project\\(['"]:${slug}['"]\\)\\.projectDir\\s*=\\s*new\\s+File\\(['"]([^'"]+)['"]\\)`);
    const match = combinedSettings.match(dirPattern);
    if (!match) {
      errors.push(`Plugin ${plugin} (:${slug}) is missing from android/settings.gradle`);
    } else {
      const resolvedDir = path.resolve('android', match[1]);
      if (!fs.existsSync(resolvedDir)) {
        errors.push(`Plugin ${plugin} projectDir does not exist: ${resolvedDir}`);
      }
    }
  }
}

if (!fs.existsSync(variablesGradlePath)) {
  errors.push('Missing android/variables.gradle');
} else {
  const varsContent = fs.readFileSync(variablesGradlePath, 'utf8');
  const expectedVars = {
    minSdkVersion: '24',
    compileSdkVersion: '36',
    targetSdkVersion: '35',
  };
  const requiredKeys = [
    'androidxActivityVersion',
    'androidxAppCompatVersion',
    'androidxCoordinatorLayoutVersion',
    'coreSplashScreenVersion',
    'androidxCoreVersion',
    'androidxFragmentVersion',
    'cordovaAndroidVersion',
  ];

  const seenKeys = new Map();
  for (const rawLine of varsContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line === 'ext {' || line === '}') continue;
    const eqMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (eqMatch) {
      const key = eqMatch[1];
      seenKeys.set(key, (seenKeys.get(key) || 0) + 1);
    }
  }

  for (const [key, count] of seenKeys.entries()) {
    if (count > 1) {
      errors.push(`Duplicate variable "${key}" found ${count} times in android/variables.gradle`);
    }
  }

  for (const [key, val] of Object.entries(expectedVars)) {
    const re = new RegExp(`\\b${key}\\s*=\\s*${val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (!re.test(varsContent)) {
      errors.push(`android/variables.gradle must define ${key} = ${val}`);
    }
  }

  for (const key of requiredKeys) {
    if (!seenKeys.has(key)) {
      errors.push(`android/variables.gradle is missing required key ${key}`);
    }
  }
}

if (!fs.existsSync(appBuildGradlePath)) {
  errors.push('Missing android/app/build.gradle');
} else {
  const buildGradle = fs.readFileSync(appBuildGradlePath, 'utf8');
  if (!buildGradle.includes('rootProject.ext.compileSdkVersion')) {
    errors.push('android/app/build.gradle must use rootProject.ext.compileSdkVersion');
  }
  if (/compileSdk(?:Version)?\s*=?\s*\d+/.test(buildGradle)) {
    errors.push('android/app/build.gradle contains a hardcoded compileSdk number');
  }
  if (!buildGradle.includes('GITHUB_RUN_NUMBER')) {
    warnings.push('android/app/build.gradle does not reference GITHUB_RUN_NUMBER for versionCode');
  }
}

if (!fs.existsSync(manifestPath)) {
  errors.push('Missing android/app/src/main/AndroidManifest.xml');
} else {
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  if (!manifest.includes('android:supportsRtl="true"')) {
    errors.push('AndroidManifest.xml must include android:supportsRtl="true"');
  }
}

if (warnings.length > 0) {
  console.warn('Warnings:\n' + warnings.map((w) => `  - ${w}`).join('\n'));
}

if (errors.length > 0) {
  console.error('Android configuration verification FAILED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log(
  `Android configuration verified successfully (${expectedCapPlugins.length} Capacitor plugins matched, no duplicate variables).`,
);
