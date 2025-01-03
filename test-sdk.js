import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

console.log('Starting SDK test...');

// Module resolution tests
async function testModuleResolution() {
  console.log('\nTesting module resolution...');
  try {
    // Test core SDK imports using dynamic import
    await import('@modelcontextprotocol/sdk');
    await import('@modelcontextprotocol/sdk/server/index.js');
    await import('@modelcontextprotocol/sdk/server/stdio.js');
    console.log('Core SDK modules resolved successfully');
    
    // Test local imports
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const indexPath = path.join(__dirname, '../src/index.js');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`index.js not found at ${indexPath}`);
    }
    console.log('Local modules resolved successfully');
  } catch (error) {
    console.error('Module resolution error:', error);
    throw error;
  }
}

// Configuration validation
function testConfiguration() {
  console.log('\nTesting configuration...');
  try {
    // Check optional environment variables
    if (process.env.NODE_ENV) {
      console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    }
    if (process.env.MCP_API_KEY) {
      console.log('MCP_API_KEY detected');
    }
    console.log('Environment variables checked');
  } catch (error) {
    console.error('Configuration error:', error);
    throw error;
  }
}

// Dependency version testing
function testDependencies() {
  console.log('\nTesting dependencies...');
  try {
    // Check Node.js version
    const nodeVersion = process.versions.node;
    const [major] = nodeVersion.split('.');
    if (Number(major) < 16) {
      throw new Error(`Node.js version ${nodeVersion} is not supported. Requires 16+`);
    }
    console.log(`Node.js version ${nodeVersion} supported`);

    // Check SDK version
    const sdkPackage = JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'node_modules/@modelcontextprotocol/sdk/package.json'),
      'utf-8'
    ));
    if (!sdkPackage.version) {
      throw new Error('Could not determine SDK version');
    }
    console.log(`SDK version ${sdkPackage.version} detected`);
  } catch (error) {
    console.error('Dependency error:', error);
    throw error;
  }
}

// Basic project validation
function testProjectStructure() {
  console.log('\nTesting project structure...');
  try {
    // Check main entry point exists
    const indexPath = path.join(process.cwd(), 'src/index.js');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`index.js not found at ${indexPath}`);
    }
    console.log('Project structure validated');
  } catch (error) {
    console.error('Project structure error:', error);
    throw error;
  }
}

async function testSDK() {
  // Run all test suites
  await testModuleResolution();
  testConfiguration();
  testDependencies();
  testProjectStructure();
  try {
    console.log('Creating server instance...');
    const server = new Server({
      name: "TestServer",
      version: "1.0.0"
    }, {
      capabilities: {
        sampling: true,
        logging: true,
        prompts: true,
        resources: true,
        tools: true
      }
    });
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('Server connected successfully');
    console.log('Server capabilities:', JSON.stringify(server.getCapabilities(), null, 2));
  } catch (error) {
    console.error('SDK error:', error);
    process.exit(1);
  }
}

testSDK().then(() => {
  console.log('Test completed successfully');
  process.exit(0);
});
