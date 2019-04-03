/**
 * @flow
 */
import path from 'path';

import findAndroidAppFolder from '../android/findAndroidAppFolder';
import findAndroidManifest from '../android/findManifest';
import findAndroidPackageClassName from '../android/findPackageClassName';
import readAndroidManifest from '../android/readManifest';

import findIOSPodspecName from '../ios/findPodspecName';

import type {
  InputDependencyConfigIOS,
  DependencyConfigIOS,
  InputDependencyConfigAndroid,
  DependencyConfigAndroid,
} from './types.flow';

const getAndroidSourceDir = (folder: string) => {
  const androidFolder = findAndroidAppFolder(folder);
  if (!androidFolder) {
    return null;
  }
  return path.join(folder, androidFolder);
};

export function android(
  folder: string,
  userConfig: InputDependencyConfigAndroid,
): ?DependencyConfigAndroid {
  const packageInstance = userConfig.packageInstance
    ? userConfig.packageInstance
    : (() => {
        const sourceDir = getAndroidSourceDir(folder);
        if (!sourceDir) {
          return null;
        }
        const packageClassName = findAndroidPackageClassName(sourceDir);
        return `new ${packageClassName}()`;
      })();

  const packageImportPath = userConfig.packageImportPath
    ? userConfig.packageImportPath
    : (() => {
        const sourceDir = getAndroidSourceDir(folder);
        if (!sourceDir) {
          return null;
        }
        const manifestPath = findAndroidManifest(sourceDir);
        if (!manifestPath) {
          return null;
        }
        const manifest = readAndroidManifest(manifestPath);
        const packageClassName = findAndroidPackageClassName(sourceDir);
        const packageName = manifest.attr.package;
        return `import ${packageName}.${packageClassName};`;
      })();

  if (packageInstance === null || packageImportPath === null) {
    return null;
  }

  return {packageImportPath, packageInstance};
}

/**
 * This adds back the extname that was stripped by `findPodspecName`,
 * because `findPodspecName` for now needs to remain backwards compatible
 * for the `link` command.
 */
export function ios(
  folder: string,
  userConfig: InputDependencyConfigIOS,
): ?DependencyConfigIOS {
  const podspec = userConfig.podspec
    ? userConfig.podspec
    : findIOSPodspecName(folder);

  if (!podspec) {
    return null;
  }

  return {podspec: `${podspec}.podspec`};
}
