/**
 * 完整性监控器
 * 定期运行完整性检查，监控聚合根的健康状态
 * 与告警系统集成，在发现问题时通知管理员
 */

import { IntegrityCheckService } from './IntegrityCheckService';
import type { IntegrityCheckStats } from './IntegrityCheckService';

/**
 * 监控告警配置
 */
export interface MonitoringAlertConfig {
  /** 完整性检查失败率告警阈值（百分比，0-100） */
  failureRateThreshold: number;
  
  /** 严重违规数量告警阈值 */
  criticalViolationThreshold: number;
  
  /** 自动修复失败数量告警阈值 */
  autoHealFailureThreshold: number;
}

/**
 * 监控告警事件
 */
export interface MonitoringAlert {
  /** 告警类型 */
  type: 'FAILURE_RATE_HIGH' | 'CRITICAL_VIOLATIONS' | 'AUTO_HEAL_FAILURE' | 'SCAN_ERROR';
  
  /** 告警级别 */
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  
  /** 告警消息 */
  message: string;
  
  /** 关联的统计信息 */
  stats?: IntegrityCheckStats;
  
  /** 告警时间 */
  timestamp: Date;
}

/**
 * 完整性监控器
 * 
 * 职责：
 * 1. 定期调用 IntegrityCheckService 进行扫描
 * 2. 分析扫描结果
 * 3. 当发现问题时生成告警
 * 4. 记录监控历史
 * 5. 支持手动触发检查
 */
export class IntegrityMonitor {
  /** 监控定时器 ID */
  private monitoringTimerId: NodeJS.Timeout | null = null;
  
  /** 告警历史（最近 100 条） */
  private alertHistory: MonitoringAlert[] = [];
  
  /** 扫描历史（最近 50 次） */
  private scanHistory: IntegrityCheckStats[] = [];
  
  /** 监控是否运行中 */
  private isMonitoring: boolean = false;
  
  /** 默认告警配置 */
  private alertConfig: MonitoringAlertConfig = {
    failureRateThreshold: 5,           // 失败率 > 5% 触发告警
    criticalViolationThreshold: 10,    // 严重违规 > 10 个触发告警
    autoHealFailureThreshold: 20       // 自动修复失败 > 20 个触发告警
  };
  
  constructor(
    private integrityService: IntegrityCheckService,
    alertConfig?: Partial<MonitoringAlertConfig>
  ) {
    if (alertConfig) {
      this.alertConfig = { ...this.alertConfig, ...alertConfig };
    }
  }
  
  /**
   * 开始定期监控
   * 
   * @param scanIntervalMs 扫描间隔（毫秒，默认每天一次）
   * @example
   * // 每小时扫描一次
   * monitor.startMonitoring(3600000);
   * 
   * // 每天扫描一次（默认）
   * monitor.startMonitoring();
   */
  async startMonitoring(scanIntervalMs: number = 86400000): Promise<void> {
    if (this.isMonitoring) {
      console.warn('⚠️ [IntegrityMonitor] 监控已在运行，无需重复启动');
      return;
    }
    
    this.isMonitoring = true;
    console.log(`🚀 [IntegrityMonitor] 开始定期完整性监控，扫描间隔: ${scanIntervalMs}ms`);
    
    // 立即执行一次扫描
    await this.performScan();
    
    // 设置定期扫描
    this.monitoringTimerId = setInterval(async () => {
      await this.performScan();
    }, scanIntervalMs);
  }
  
  /**
   * 停止监控
   */
  async stopMonitoring(): Promise<void> {
    if (this.monitoringTimerId) {
      clearInterval(this.monitoringTimerId);
      this.monitoringTimerId = null;
    }
    this.isMonitoring = false;
    console.log('🛑 [IntegrityMonitor] 完整性监控已停止');
  }
  
  /**
   * 执行一次完整性扫描
   * 这是核心方法，由定期任务调用
   */
  private async performScan(): Promise<IntegrityCheckStats | null> {
    console.log('📊 [IntegrityMonitor] 执行完整性扫描...');
    
    const startTime = Date.now();
    
    try {
      // 模拟扫描（实际实现将在下一阶段添加）
      // 这里展示的是监控框架的结构
      const stats: IntegrityCheckStats = {
        totalCount: 0,
        passedCount: 0,
        failedCount: 0,
        failureRate: 0,
        violationCount: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        autoHealedCount: 0,
        manualInterventionCount: 0,
        durationMs: Date.now() - startTime,
        scanTime: new Date()
      };
      
      // 记录扫描历史
      this.recordScanHistory(stats);
      
      // 分析结果并生成告警
      this.analyzeAndAlert(stats);
      
      console.log(`✅ [IntegrityMonitor] 扫描完成: ${stats.totalCount} 个聚合根, ` +
        `失败率: ${stats.failureRate}%, 耗时: ${stats.durationMs}ms`);
      
      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error(`❌ [IntegrityMonitor] 扫描失败: ${message}`);
      
      // 记录扫描错误告警
      this.createAlert({
        type: 'SCAN_ERROR',
        severity: 'CRITICAL',
        message: `完整性扫描失败: ${message}`,
        timestamp: new Date()
      });
      
      return null;
    }
  }
  
  /**
   * 分析扫描结果并生成必要的告警
   */
  private analyzeAndAlert(stats: IntegrityCheckStats): void {
    // 检查 1: 失败率
    if (stats.failureRate > this.alertConfig.failureRateThreshold) {
      this.createAlert({
        type: 'FAILURE_RATE_HIGH',
        severity: 'CRITICAL',
        message: `完整性检查失败率过高: ${stats.failureRate}% ` +
          `(阈值: ${this.alertConfig.failureRateThreshold}%)`,
        stats,
        timestamp: new Date()
      });
    }
    
    // 检查 2: 严重违规数量
    if (stats.criticalCount > this.alertConfig.criticalViolationThreshold) {
      this.createAlert({
        type: 'CRITICAL_VIOLATIONS',
        severity: 'CRITICAL',
        message: `检测到过多严重违规: ${stats.criticalCount} 个 ` +
          `(阈值: ${this.alertConfig.criticalViolationThreshold})`,
        stats,
        timestamp: new Date()
      });
    }
    
    // 检查 3: 自动修复失败
    const autoHealFailures = stats.manualInterventionCount - stats.autoHealedCount;
    if (autoHealFailures > this.alertConfig.autoHealFailureThreshold) {
      this.createAlert({
        type: 'AUTO_HEAL_FAILURE',
        severity: 'WARNING',
        message: `自动修复失败过多: ${autoHealFailures} 个 ` +
          `(阈值: ${this.alertConfig.autoHealFailureThreshold})`,
        stats,
        timestamp: new Date()
      });
    }
    
    // 如果没有告警，记录成功扫描
    if (stats.failedCount === 0) {
      console.log('✨ [IntegrityMonitor] 所有聚合根完整性检查通过');
    }
  }
  
  /**
   * 创建和记录一个告警
   */
  private createAlert(alert: MonitoringAlert): void {
    this.alertHistory.push(alert);
    
    // 保持告警历史大小在可控范围
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }
    
    // 输出告警信息
    const prefix = alert.severity === 'CRITICAL' ? '🚨' : '⚠️';
    console.log(`${prefix} [Alert] ${alert.type}: ${alert.message}`);
  }
  
  /**
   * 记录扫描历史
   */
  private recordScanHistory(stats: IntegrityCheckStats): void {
    this.scanHistory.push(stats);
    
    // 保持扫描历史大小在可控范围
    if (this.scanHistory.length > 50) {
      this.scanHistory.shift();
    }
  }
  
  /**
   * 获取最近的告警列表
   */
  getRecentAlerts(limit: number = 20): MonitoringAlert[] {
    return this.alertHistory.slice(-limit);
  }
  
  /**
   * 获取扫描历史
   */
  getScanHistory(limit: number = 10): IntegrityCheckStats[] {
    return this.scanHistory.slice(-limit);
  }
  
  /**
   * 获取监控状态
   */
  getStatus(): {
    isMonitoring: boolean;
    alertCount: number;
    scanCount: number;
    lastAlert?: MonitoringAlert;
    lastScan?: IntegrityCheckStats;
  } {
    return {
      isMonitoring: this.isMonitoring,
      alertCount: this.alertHistory.length,
      scanCount: this.scanHistory.length,
      lastAlert: this.alertHistory[this.alertHistory.length - 1],
      lastScan: this.scanHistory[this.scanHistory.length - 1]
    };
  }
  
  /**
   * 手动触发一次扫描（用于测试或紧急检查）
   */
  async triggerManualScan(): Promise<IntegrityCheckStats | null> {
    console.log('🔍 [IntegrityMonitor] 手动触发完整性扫描...');
    return this.performScan();
  }
  
  /**
   * 更新告警配置
   */
  updateAlertConfig(config: Partial<MonitoringAlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
    console.log('✅ [IntegrityMonitor] 告警配置已更新');
  }
}
