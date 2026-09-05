// =============================================================================
// @vaultmind/mcp — Public API
// MCP server for AI agent payment controls
// =============================================================================

export { createPaySentryMcpServer } from './server.js';
export type { CreateServerResult } from './server.js';
export { VaultMindStack, PaySentryStack, DEFAULT_CONFIG } from './stack.js';
export type { McpServerConfig, WalletState, PaymentResult, ProcessPaymentOptions, CapabilityManifest, ToolDescription } from './types.js';
