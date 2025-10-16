// DNS 模块统一导出

export * from './types';
export * from './providers';
export * from './manager';

// 默认导出 DNS 管理器
export { default as dnsManager } from './manager';
