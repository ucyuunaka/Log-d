// 创建新文件用于IndexedDB存储管理

export class IndexedDBManager {
  constructor() {
    this.dbName = 'LogDDatabase';
    this.dbVersion = 1;
    this.db = null;
    this.initDB();
  }

  initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('logs')) {
          db.createObjectStore('logs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };
      
      request.onerror = (event) => {
        console.error('IndexedDB初始化失败:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // 保存日志到IndexedDB
  async saveLogs(logs) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['logs'], 'readwrite');
      const store = transaction.objectStore('logs');
      
      // 清除旧数据
      store.clear();
      
      // 添加新数据
      let count = 0;
      logs.forEach(log => {
        store.add(log);
        count++;
      });
      
      transaction.oncomplete = () => resolve(count);
      transaction.onerror = (e) => reject(e.target.error);
    });
  }

  // 从IndexedDB获取所有日志
  async getLogs() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['logs'], 'readonly');
      const store = transaction.objectStore('logs');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // 获取数据库连接
  getDB() {
    if (this.db) return Promise.resolve(this.db);
    return this.initDB();
  }
}

export default new IndexedDBManager();
