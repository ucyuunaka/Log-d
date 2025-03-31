// 添加新的备份管理模块

import { getLogsFromStorage, showToast } from './utils.js';

export class BackupManager {
  constructor(options = {}) {
    this.toastContainer = options.toastContainer || document.body;
    this.autoBackupInterval = options.autoBackupInterval || 7 * 24 * 60 * 60 * 1000; // 默认7天
    this.lastBackupDate = localStorage.getItem('lastAutoBackupDate') || null;
    this.maxAutoBackups = options.maxAutoBackups || 5;
    
    this.init();
  }
  
  init() {
    this.checkAutoBackup();
    
    // 设置定期检查
    setInterval(() => this.checkAutoBackup(), 60 * 60 * 1000); // 每小时检查一次
  }
  
  checkAutoBackup() {
    const now = new Date().getTime();
    
    // 如果从未备份或距离上次备份时间超过设定间隔
    if (!this.lastBackupDate || (now - new Date(this.lastBackupDate).getTime() > this.autoBackupInterval)) {
      this.createAutoBackup();
    }
  }
  
  async createAutoBackup() {
    try {
      const logs = getLogsFromStorage();
      if (!logs.length) return; // 无内容不备份
      
      const backupData = JSON.stringify(logs);
      const filename = `墨记自动备份_${new Date().toISOString().slice(0, 10)}.json`;
      
      // 使用 IndexedDB 存储备份
      await this.saveBackupToIDB(filename, backupData);
      
      // 更新最后备份时间
      this.lastBackupDate = new Date().toISOString();
      localStorage.setItem('lastAutoBackupDate', this.lastBackupDate);
      
      // 清理旧备份
      this.cleanupOldBackups();
      
      console.log('自动备份完成:', filename);
    } catch (error) {
      console.error('自动备份失败:', error);
    }
  }
  
  async saveBackupToIDB(filename, data) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BackupDatabase', 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'filename' });
        }
      };
      
      request.onerror = () => reject(new Error('无法打开备份数据库'));
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        const transaction = db.transaction(['backups'], 'readwrite');
        const store = transaction.objectStore('backups');
        
        const backup = {
          filename,
          data,
          timestamp: new Date().toISOString()
        };
        
        const saveRequest = store.put(backup);
        
        saveRequest.onsuccess = () => resolve();
        saveRequest.onerror = () => reject(new Error('保存备份失败'));
      };
    });
  }
  
  async getBackupsList() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BackupDatabase', 1);
      
      request.onerror = () => reject(new Error('无法打开备份数据库'));
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('backups')) {
          return resolve([]);
        }
        
        const transaction = db.transaction(['backups'], 'readonly');
        const store = transaction.objectStore('backups');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          const backups = getAllRequest.result.map(backup => ({
            filename: backup.filename,
            timestamp: backup.timestamp
          })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          resolve(backups);
        };
        
        getAllRequest.onerror = () => reject(new Error('获取备份列表失败'));
      };
    });
  }
  
  async restoreFromBackup(filename) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BackupDatabase', 1);
      
      request.onerror = () => reject(new Error('无法打开备份数据库'));
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        const transaction = db.transaction(['backups'], 'readonly');
        const store = transaction.objectStore('backups');
        const getRequest = store.get(filename);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            try {
              const logs = JSON.parse(getRequest.result.data);
              localStorage.setItem('userLogs', JSON.stringify(logs));
              showToast(`已从备份 ${filename} 恢复数据`, 'success', this.toastContainer);
              resolve(true);
              
              // 需要重新加载日志列表
              window.dispatchEvent(new CustomEvent('logsRestored'));
            } catch (error) {
              reject(new Error('恢复备份数据失败'));
            }
          } else {
            reject(new Error('找不到指定的备份'));
          }
        };
        
        getRequest.onerror = () => reject(new Error('读取备份失败'));
      };
    });
  }
  
  async cleanupOldBackups() {
    try {
      const backups = await this.getBackupsList();
      
      // 如果备份数量超过限制，删除最旧的
      if (backups.length > this.maxAutoBackups) {
        const oldBackups = backups.slice(this.maxAutoBackups);
        
        for (const backup of oldBackups) {
          await this.deleteBackup(backup.filename);
        }
      }
    } catch (error) {
      console.error('清理旧备份失败:', error);
    }
  }
  
  async deleteBackup(filename) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BackupDatabase', 1);
      
      request.onerror = () => reject(new Error('无法打开备份数据库'));
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        const transaction = db.transaction(['backups'], 'readwrite');
        const store = transaction.objectStore('backups');
        const deleteRequest = store.delete(filename);
        
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(new Error('删除备份失败'));
      };
    });
  }
}

export default new BackupManager();
