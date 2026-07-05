const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');

describe('SshBridge', () => {
  it('should be creatable', () => {
    const SshBridge = require('../ssh-bridge');
    const mockSocket = { on: () => {}, send: () => {} };
    const bridge = new SshBridge(mockSocket);
    assert.ok(bridge);
    bridge.close();
  });
});
