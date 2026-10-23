/**
 * Electron 预加载脚本
 * 
 * 职责：
 * - 在渲染进程中暴露安全的 API
 * - 桥接主进程和渲染进程通信
 */
import { contextBridge, ipcRenderer } from 'electron';

/**
 * 暴露给渲染进程的 API
 */
const electronAPI = {
  /**
   * 获取应用路径
   * @param name 路径名称（userData, documents, downloads 等）
   */
  getAppPath: (name: string): Promise<string> => {
    return ipcRenderer.invoke('get-app-path', name);
  },

  /**
   * 获取应用版本
   */
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version');
  },

  /**
   * 获取平台信息
   */
  getPlatform: (): Promise<NodeJS.Platform> => {
    return ipcRenderer.invoke('get-platform');
  },

  /**
   * 发送消息到主进程
   */
  send: (channel: string, ...args: unknown[]): void => {
    const validChannels = ['toMain', 'minimize', 'maximize', 'close'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },

  /**
   * 监听来自主进程的消息
   */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    const validChannels = ['fromMain', 'theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    }
  },

  /**
   * 移除监听器
   */
  removeListener: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, callback);
  },
};

// 将 API 暴露到 window.electron
contextBridge.exposeInMainWorld('electron', electronAPI);

// 类型声明（供 TypeScript 使用）
export type ElectronAPI = typeof electronAPI;
