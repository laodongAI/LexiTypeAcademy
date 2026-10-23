/**
 * 领域错误基类
 * 所有领域层的错误都应该继承这个基类
 */
export abstract class DomainError extends Error {
  /**
   * 错误代码，用于唯一标识错误类型
   */
  public readonly code: string;

  /**
   * 错误详情，包含额外的上下文信息
   */
  public readonly details?: Record<string, unknown>;

  /**
   * 是否可重试
   * - true: 系统异常，可能通过重试解决（如网络错误、文件系统错误）
   * - false: 业务异常，重试无意义（如音频未找到、格式不支持）
   */
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: string,
    isRetryable: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.isRetryable = isRetryable;
    this.details = details;

    // 维护正确的原型链（TypeScript编译为ES5时需要）
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 业务异常：音频未找到
 * 场景：请求的音频文件不存在于缓存或存储中
 */
export class AudioNotFoundError extends DomainError {
  constructor(audioId: string, details?: Record<string, unknown>) {
    super(
      `音频未找到: ${audioId}`,
      'AUDIO_NOT_FOUND',
      false, // 不可重试
      { audioId, ...details }
    );
  }
}

/**
 * 业务异常：音频格式无效
 * 场景：音频文件格式不支持或数据损坏
 */
export class InvalidAudioFormatError extends DomainError {
  constructor(format: string, details?: Record<string, unknown>) {
    super(
      `不支持的音频格式: ${format}`,
      'INVALID_AUDIO_FORMAT',
      false, // 不可重试
      { format, ...details }
    );
  }
}

/**
 * 业务异常：音频配额超限
 * 场景：IndexedDB存储空间超过限制
 */
export class AudioQuotaExceededError extends DomainError {
  constructor(currentUsage: number, limit: number, details?: Record<string, unknown>) {
    super(
      `音频存储配额超限: ${(currentUsage / 1024 / 1024).toFixed(2)}MB / ${(limit / 1024 / 1024).toFixed(2)}MB`,
      'AUDIO_QUOTA_EXCEEDED',
      false, // 不可重试（需要清理空间后才能继续）
      { currentUsage, limit, ...details }
    );
  }
}

/**
 * 系统异常：文件系统错误
 * 场景：读写文件时发生错误（权限不足、磁盘满等）
 */
export class FileSystemError extends DomainError {
  constructor(operation: string, path: string, details?: Record<string, unknown>) {
    super(
      `文件系统操作失败: ${operation} - ${path}`,
      'FILE_SYSTEM_ERROR',
      true, // 可重试
      { operation, path, ...details }
    );
  }
}

/**
 * 系统异常：网络错误
 * 场景：TTS/ASR API调用失败、音频下载失败等
 */
export class NetworkError extends DomainError {
  constructor(url: string, statusCode?: number, details?: Record<string, unknown>) {
    super(
      `网络请求失败: ${url}${statusCode ? ` (${statusCode})` : ''}`,
      'NETWORK_ERROR',
      true, // 可重试
      { url, statusCode, ...details }
    );
  }
}

/**
 * 系统异常：WASM加载错误
 * 场景：Sherpa-ONNX WASM模块加载失败
 */
export class WasmLoadError extends DomainError {
  constructor(moduleName: string, details?: Record<string, unknown>) {
    super(
      `WASM模块加载失败: ${moduleName}`,
      'WASM_LOAD_ERROR',
      true, // 可重试
      { moduleName, ...details }
    );
  }
}
