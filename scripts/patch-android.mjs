import fs from 'node:fs';
import path from 'node:path';

const aapt2 = process.argv[2] || '';
const sdk = process.argv[3] || '';
const root = process.cwd();
const manifestPath = path.join(root, 'android/app/src/main/AndroidManifest.xml');
const gradlePath = path.join(root, 'android/gradle.properties');

if (fs.existsSync(manifestPath)) {
  let xml = fs.readFileSync(manifestPath, 'utf8');
  if (!xml.includes('android:showWhenLocked')) {
    xml = xml.replace(
      '<activity',
      '<activity\n            android:showWhenLocked="true"\n            android:turnScreenOn="true"',
    );
    fs.writeFileSync(manifestPath, xml);
  }
}

if (aapt2) {
  let props = fs.existsSync(gradlePath) ? fs.readFileSync(gradlePath, 'utf8') : '';
  const line = `android.aapt2FromMavenOverride=${aapt2}`;
  if (props.includes('android.aapt2FromMavenOverride=')) {
    props = props.replace(/android\.aapt2FromMavenOverride=.*/g, line);
  } else {
    if (props && !props.endsWith('\n')) props += '\n';
    props += `${line}\n`;
  }
  fs.writeFileSync(gradlePath, props);
}

if (sdk) {
  fs.writeFileSync(path.join(root, 'android/local.properties'), `sdk.dir=${sdk}\n`);
}

const iconSrc = path.join(root, 'native/android/res/drawable/ic_stat_chronostasis.xml');
const drawableDir = path.join(root, 'android/app/src/main/res/drawable');
if (fs.existsSync(iconSrc) && fs.existsSync(path.join(root, 'android/app'))) {
  fs.mkdirSync(drawableDir, { recursive: true });
  fs.copyFileSync(iconSrc, path.join(drawableDir, 'ic_stat_chronostasis.xml'));
}
