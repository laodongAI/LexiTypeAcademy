/**
 * IndexedDB 导出脚本（在旧版应用中执行）
 *
 * 用途：
 *   把旧应用的 IndexedDB 数据（库名 LexiTypeAcademyDB）导出为 JSON 文件，
 *   再由新后端导入校验，完成历史数据迁移。
 *
 * 使用方法：
 *   1. 打开仍在使用中的旧版应用（Electron 版或旧前端页面）
 *   2. 打开开发者工具 Console
 *   3. 整体粘贴本文件内容并回车执行
 *   4. 浏览器会下载 lexitype-export-<时间戳>.json
 *   5. 把该文件交给后端导入：python -m app.services.migration.cli <文件路径>
 *
 * 说明：
 *   - ttsCacheItems 不导出：音频 Blob 体积大且可重建，换引擎后缓存键失效
 *   - 所有 Date 会被转换为毫秒时间戳，与后端字段语义一致
 *   - 其它不可序列化的值（Blob/ArrayBuffer/TypedArray）会被替换为占位标记并计数
 *   - 导出为只读操作，不会修改或删除任何现有数据
 */

(async function exportLexiTypeIndexedDB() {
  /** 数据库名称：冻结标识，改名会导致读取不到旧数据 */
  const DB_NAME = 'LexiTypeAcademyDB';

  /** 导出格式版本号，后端按此判断兼容性 */
  const SCHEMA_VERSION = 1;

  /** 明确跳过的集合：可重建的音频缓存 */
  const SKIPPED_COLLECTIONS = ['ttsCacheItems'];

  /**
   * 统计不可序列化值的替换次数
   * 说明：导出后据此判断是否存在未被覆盖的 Blob 字段
   */
  const replacedValueCounter = { total: 0, byCollection: {} };

  /**
   * 把单个值转换为可 JSON 序列化的形式
   * @param {unknown} value 原始值
   * @param {string} collection 所属集合名（用于统计）
   * @returns {unknown} 可序列化值
   */
  function toSerializable(value, collection) {
    // 空值直接返回
    if (value === null || value === undefined) {
      return value;
    }

    // 日期转毫秒时间戳，与后端字段语义保持一致
    if (value instanceof Date) {
      return value.getTime();
    }

    // 数组：递归处理每一项
    if (Array.isArray(value)) {
      return value.map((item) => toSerializable(item, collection));
    }

    // 二进制数据：不导出内容，仅记录占位标记
    if (
      value instanceof Blob ||
      value instanceof ArrayBuffer ||
      ArrayBuffer.isView(value)
    ) {
      replacedValueCounter.total += 1;
      replacedValueCounter.byCollection[collection] =
        (replacedValueCounter.byCollection[collection] || 0) + 1;
      return { __type: 'binary-omitted' };
    }

    // 普通对象：逐字段递归处理
    if (typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value)) {
        result[key] = toSerializable(value[key], collection);
      }
      return result;
    }

    // 基础类型：原样返回
    return value;
  }

  /**
   * 打开数据库（只读用途，不指定版本以避免触发升级）
   * @returns {Promise<IDBDatabase>}
   */
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('打开数据库失败'));
      request.onblocked = () => reject(new Error('数据库被其它标签页占用，请关闭后重试'));
    });
  }

  /**
   * 读取一个 objectStore 的全部记录
   * @param {IDBDatabase} db 数据库实例
   * @param {string} storeName 集合名
   * @returns {Promise<unknown[]>}
   */
  function readAll(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error(`读取 ${storeName} 失败`));
    });
  }

  try {
    // 打开数据库
    const db = await openDatabase();

    /** 全部集合名 */
    const storeNames = Array.from(db.objectStoreNames);

    /** 导出结果：集合名 → 记录数组 */
    const tables = {};

    // 逐集合读取并序列化
    for (const storeName of storeNames) {
      // 跳过音频缓存
      if (SKIPPED_COLLECTIONS.includes(storeName)) {
        console.info(`[导出] 跳过 ${storeName}（可重建的音频缓存）`);
        continue;
      }

      const rawRows = await readAll(db, storeName);
      tables[storeName] = rawRows.map((row) => toSerializable(row, storeName));
      console.info(`[导出] ${storeName}: ${rawRows.length} 条`);
    }

    // 关闭数据库连接，避免阻塞旧应用后续操作
    db.close();

    // 组装导出载荷
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      dbName: DB_NAME,
      origin: location.origin,
      exportedAt: new Date().toISOString(),
      skippedCollections: SKIPPED_COLLECTIONS,
      binaryReplacement: replacedValueCounter,
      tables,
    };

    // 生成文件名并触发下载
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `lexitype-export-${stamp}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    console.info(`[导出] 完成：${fileName}`);
    console.info('[导出] 各集合条数：', Object.fromEntries(
      Object.entries(tables).map(([key, rows]) => [key, rows.length]),
    ));
    if (replacedValueCounter.total > 0) {
      console.warn('[导出] 存在不可序列化的二进制值，已被占位替换：', replacedValueCounter);
    }
  } catch (error) {
    console.error('[导出] 失败：', error);
    throw error;
  }
})();
