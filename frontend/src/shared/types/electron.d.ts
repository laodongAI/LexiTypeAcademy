/**
 * 全局类型声明
 */
import type { ElectronAPI } from '../preload/index';

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
