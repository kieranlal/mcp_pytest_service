import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

console.log('Starting SDK test...');

async function testSDK() {
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
