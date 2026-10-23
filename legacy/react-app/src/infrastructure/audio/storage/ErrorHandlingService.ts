import { DomainError } from '../../../domain/errors/DomainError';

/**
 * 错误处理服务
 * 根据错误类型采取不同的恢复策略
 */
export class ErrorHandlingService {
  /**
   * 处理领域错误
   * @param error 错误对象
   * @param retryFn 重试函数（可选）
   * @param maxRetries 最大重试次数（默认3次）
   * @returns 错误是否已处理
   */
  async handleDomainError(
    error: Error,
    retryFn?: () => Promise<void>,
    maxRetries: number = 3
  ): Promise<boolean> {
    // 如果是领域错误，根据isRetryable属性决定是否重试
    if (error instanceof DomainError) {
      console.error(`[DomainError] ${error.code}: ${error.message}`, error.details);

      // 系统异常，可重试
      if (error.isRetryable && retryFn) {
        console.log(`[ErrorHandling] 错误可重试，开始重试... (最多${maxRetries}次)`);
        return await this.retryWithExponentialBackoff(retryFn, maxRetries);
      }

      // 业务异常，不可重试
      console.log(`[ErrorHandling] 业务异常，不执行重试`);
      return false;
    }

    // 未知错误，记录日志
    console.error(`[UnknownError]`, error);
    return false;
  }

  /**
   * 使用指数退避策略重试
   * @param fn 重试函数
   * @param maxRetries 最大重试次数
   * @param baseDelay 基础延迟（毫秒，默认1000ms）
   * @returns 是否重试成功
   */
  private async retryWithExponentialBackoff(
    fn: () => Promise<void>,
    maxRetries: number,
    baseDelay: number = 1000
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fn();
        console.log(`[ErrorHandling] 重试成功 (第${attempt}次尝试)`);
        return true;
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`[ErrorHandling] 重试失败，已达最大重试次数 (${maxRetries}次)`);
          return false;
        }

        // 计算延迟时间：baseDelay * 2^(attempt-1)
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[ErrorHandling] 第${attempt}次重试失败，等待${delay}ms后重试...`);
        await this.sleep(delay);
      }
    }

    return false;
  }

  /**
   * 延迟执行
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
