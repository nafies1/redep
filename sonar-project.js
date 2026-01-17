import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sonarScannerModule = require('@sonar/scan');
const sonarScanner = sonarScannerModule.scan || sonarScannerModule.default || sonarScannerModule;

sonarScanner(
  {
    serverUrl: process.env.SONAR_HOST_URL || 'http://localhost:9000',
    token: process.env.SONAR_TOKEN,
    options: {
      'sonar.projectKey': 'remote-deploy-cli',
      'sonar.projectName': 'Remote Deploy CLI',
      'sonar.projectVersion': '1.0.0',
      'sonar.sources': 'bin,lib',
      'sonar.tests': 'test',
      'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
      'sonar.sourceEncoding': 'UTF-8',
    },
  },
  () => process.exit()
);
