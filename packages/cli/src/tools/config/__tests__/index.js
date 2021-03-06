/**
 * @flow
 */

import loadConfig from '../';

import {
  cleanup,
  writeFiles,
  getTempDirectory,
} from '../../../../../../e2e/helpers';

const DIR = getTempDirectory('resolve_config_path_test');

// Removes string from all key/values within an object
const removeString = (config, str) =>
  JSON.parse(
    JSON.stringify(config).replace(new RegExp(str, 'g'), '<<REPLACED>>'),
  );

beforeEach(() => {
  cleanup(DIR);
  jest.resetModules();
});

afterEach(() => cleanup(DIR));

test('should have a valid structure by default', () => {
  writeFiles(DIR, {
    'package.json': `{
      "react-native": {
        "reactNativePath": "."
      }
    }`,
  });
  const config = loadConfig(DIR);
  expect(removeString(config, DIR)).toMatchSnapshot();
});

test('should return dependencies from package.json', () => {
  writeFiles(DIR, {
    'node_modules/react-native-test/package.json': '{}',
    'node_modules/react-native-test/ios/HelloWorld.xcodeproj/project.pbxproj':
      '',
    'package.json': `{
      "dependencies": {
        "react-native-test": "0.0.1"
      },
      "react-native": {
        "reactNativePath": "."
      }
    }`,
  });
  const {dependencies} = loadConfig(DIR);
  expect(removeString(dependencies, DIR)).toMatchSnapshot();
});

test('should read a config of a dependency and use it to load other settings', () => {
  writeFiles(DIR, {
    'node_modules/react-native-test/package.json': `{
      "react-native": {
        "dependency": {
          "platforms": {
            "ios": {
              "project": "./customLocation/customProject.xcodeproj"
            }
          }
        }
      }
    }`,
    'package.json': `{
      "dependencies": {
        "react-native-test": "0.0.1"
      },
      "react-native": {
        "reactNativePath": "."
      }
    }`,
  });
  const {dependencies} = loadConfig(DIR);
  expect(
    removeString(dependencies['react-native-test'], DIR),
  ).toMatchSnapshot();
});

test('should deep merge project configuration with default values', () => {
  writeFiles(DIR, {
    'node_modules/react-native-test/package.json': '{}',
    'node_modules/react-native-test/ios/HelloWorld.xcodeproj/project.pbxproj':
      '',
    'package.json': `{
      "dependencies": {
        "react-native-test": "0.0.1"
      },
      "react-native": {
        "reactNativePath": ".",
        "dependencies": {
          "react-native-test": {
            "platforms": {
              "ios": {
                "sourceDir": "./abc"
              }
            }
          }
        }
      }
    }`,
  });
  const config = loadConfig(DIR);
  expect(removeString(config, DIR)).toMatchSnapshot();
});

test('should read `rnpm` config from a dependency and transform it to a new format', () => {
  writeFiles(DIR, {
    'node_modules/react-native-foo/package.json': `{
      "name": "react-native-foo",
      "rnpm": {
        "ios": {
          "project": "./customLocation/customProject.xcodeproj"
        }
      }
    }`,
    'package.json': `{
      "dependencies": {
        "react-native-foo": "0.0.1"
      },
      "react-native": {
        "reactNativePath": "."
      }
    }`,
  });
  const {dependencies} = loadConfig(DIR);
  expect(removeString(dependencies['react-native-foo'], DIR)).toMatchSnapshot();
});

test('should load commands from "react-native-foo" and "react-native-bar" packages', () => {
  writeFiles(DIR, {
    'node_modules/react-native-foo/package.json': `{
      "react-native": {
        "commands": [
          "./command-foo.js"
        ]
      }
    }`,
    'node_modules/react-native-bar/package.json': `{
      "react-native": {
        "commands": [
          "./command-bar.js"
        ]
      }
    }`,
    'package.json': `{
      "dependencies": {
        "react-native-foo": "0.0.1",
        "react-native-bar": "0.0.1"
      },
      "react-native": {
        "reactNativePath": "."
      }
    }`,
  });
  const {commands} = loadConfig(DIR);
  expect(removeString(commands, DIR)).toMatchSnapshot();
});

test('should load an out-of-tree "windows" platform that ships with a dependency', () => {
  writeFiles(DIR, {
    'node_modules/react-native-windows/platform.js': `
      module.exports = {"windows": {}};
    `,
    'node_modules/react-native-windows/package.json': `{
      "name": "react-native-windows",
      "rnpm": {
        "haste": {
          "platforms": [
            "windows"
          ],
          "providesModuleNodeModules": [
            "react-native-windows"
          ]
        },
        "plugin": "./plugin.js",
        "platform": "./platform.js"
      }
    }`,
    'package.json': `{
      "dependencies": {
        "react-native-windows": "0.0.1"
      },
      "react-native": {
        "reactNativePath": "."
      }
    }`,
  });
  const {haste, platforms} = loadConfig(DIR);
  expect(removeString({haste, platforms}, DIR)).toMatchSnapshot();
});
