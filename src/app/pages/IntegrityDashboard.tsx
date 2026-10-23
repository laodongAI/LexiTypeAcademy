/**
 * 完整性检查仪表板组件（UI 原型）
 * 展示聚合根的完整性检查结果和监控数据
 * 
 * 这是 Phase 2 的原型设计，演示如何在 UI 中展示完整性检查信息
 */

import React, { useState, useEffect } from 'react';
import { IntegrityCheckService } from '../../domain/services/IntegrityCheckService';
import { IntegrityMonitor } from '../../domain/services/IntegrityMonitor';
import type { IntegrityCheckStats } from '../../domain/services/IntegrityCheckService';
import type { MonitoringAlert } from '../../domain/services/IntegrityMonitor';

/**
 * 完整性仪表板 UI 组件
 * 
 * 功能：
 * 1. 显示最近扫描的统计信息
 * 2. 显示发现的违规和建议
 * 3. 显示监控告警历史
 * 4. 提供手动扫描按钮
 */
export const IntegrityDashboard: React.FC = () => {
  const [stats, setStats] = useState<IntegrityCheckStats | null>(null);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);

  useEffect(() => {
    // 组件挂载时的初始化逻辑
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // 这里将与后端服务交互
    // 实现将在真实场景中添加
    console.log('📊 [Dashboard] 加载完整性检查数据...');
  };

  const handleManualScan = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 [Dashboard] 触发手动完整性扫描...');
      // 这里调用 IntegrityMonitor.triggerManualScan()
      // 实现将在真实场景中添加
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* 页面标题 */}
      <div style={styles.header}>
        <h1 style={styles.title}>完整性检查仪表板</h1>
        <p style={styles.subtitle}>聚合根完整性监控和诊断</p>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div style={styles.statsGrid}>
          <StatCard
            title="扫描聚合根数"
            value={stats.totalCount}
            color="#2196F3"
          />
          <StatCard
            title="通过检查"
            value={stats.passedCount}
            color="#4CAF50"
            percentage={`${Math.round((stats.passedCount / stats.totalCount) * 100)}%`}
          />
          <StatCard
            title="失败数量"
            value={stats.failedCount}
            color={stats.failureRate > 5 ? '#F44336' : '#FF9800'}
            percentage={`${stats.failureRate.toFixed(1)}%`}
          />
          <StatCard
            title="发现违规"
            value={stats.violationCount}
            color="#9C27B0"
          />
          <StatCard
            title="严重级别"
            value={stats.criticalCount}
            color="#D32F2F"
            label="严重违规"
          />
          <StatCard
            title="自动修复"
            value={stats.autoHealedCount}
            color="#00BCD4"
            label="已修复"
          />
        </div>
      )}

      {/* 操作按钮 */}
      <div style={styles.actions}>
        <button
          onClick={handleManualScan}
          disabled={isLoading}
          style={{
            ...styles.button,
            opacity: isLoading ? 0.5 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? '扫描中...' : '手动扫描'}
        </button>
      </div>

      {/* 告警部分 */}
      {alerts.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>最近告警</h2>
          <div style={styles.alertList}>
            {alerts.map((alert, idx) => (
              <AlertItem key={idx} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* 详细信息部分 */}
      {selectedResult && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>详细信息</h2>
          <div style={styles.detailsBox}>
            <p><strong>聚合根：</strong> {selectedResult.aggregateId}</p>
            <p><strong>类型：</strong> {selectedResult.aggregateType}</p>
            <p><strong>状态：</strong> {selectedResult.isValid ? '✅ 通过' : '❌ 失败'}</p>
            {selectedResult.violations.length > 0 && (
              <div style={styles.violationsList}>
                <h3>发现的违规：</h3>
                {selectedResult.violations.map((v: any, idx: number) => (
                  <div key={idx} style={styles.violationItem}>
                    <p><strong>{v.code}</strong></p>
                    <p>{v.message}</p>
                    {v.remediation && <p style={styles.remediation}>💡 {v.remediation}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!stats && (
        <div style={styles.emptyState}>
          <p>📊 尚无完整性检查数据</p>
          <p style={styles.smallText}>点击"手动扫描"按钮开始检查</p>
        </div>
      )}
    </div>
  );
};

/**
 * 统计卡片组件
 */
interface StatCardProps {
  title: string;
  value: number;
  color: string;
  percentage?: string;
  label?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color, percentage, label }) => (
  <div style={{ ...styles.card, borderLeft: `4px solid ${color}` }}>
    <p style={styles.cardTitle}>{title}</p>
    <p style={{ ...styles.cardValue, color }}>{value}</p>
    {percentage && <p style={styles.cardPercentage}>{percentage}</p>}
    {label && <p style={styles.cardLabel}>{label}</p>}
  </div>
);

/**
 * 告警项目组件
 */
interface AlertItemProps {
  alert: MonitoringAlert;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert }) => (
  <div style={{
    ...styles.alertItem,
    borderLeft: `4px solid ${alert.severity === 'CRITICAL' ? '#D32F2F' : '#FF9800'}`
  }}>
    <p style={styles.alertTitle}>
      {alert.severity === 'CRITICAL' ? '🚨' : '⚠️'} {alert.type}
    </p>
    <p style={styles.alertMessage}>{alert.message}</p>
    <p style={styles.alertTime}>{new Date(alert.timestamp).toLocaleString()}</p>
  </div>
);

/**
 * 样式定义
 */
const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  } as React.CSSProperties,

  header: {
    marginBottom: '32px'
  } as React.CSSProperties,

  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
    color: '#1a1a1a'
  } as React.CSSProperties,

  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0
  } as React.CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  } as React.CSSProperties,

  card: {
    backgroundColor: '#fff',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'box-shadow 0.2s'
  } as React.CSSProperties,

  cardTitle: {
    fontSize: '12px',
    color: '#999',
    margin: '0 0 8px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  } as React.CSSProperties,

  cardValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    margin: '0 0 4px 0'
  } as React.CSSProperties,

  cardPercentage: {
    fontSize: '12px',
    color: '#666',
    margin: 0
  } as React.CSSProperties,

  cardLabel: {
    fontSize: '11px',
    color: '#999',
    margin: '4px 0 0 0'
  } as React.CSSProperties,

  actions: {
    marginBottom: '32px',
    display: 'flex',
    gap: '8px'
  } as React.CSSProperties,

  button: {
    padding: '12px 24px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  } as React.CSSProperties,

  section: {
    marginBottom: '32px'
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '0 0 16px 0',
    color: '#1a1a1a'
  } as React.CSSProperties,

  alertList: {
    display: 'grid',
    gap: '12px'
  } as React.CSSProperties,

  alertItem: {
    backgroundColor: '#fff',
    padding: '16px',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  } as React.CSSProperties,

  alertTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    margin: '0 0 8px 0'
  } as React.CSSProperties,

  alertMessage: {
    fontSize: '13px',
    color: '#666',
    margin: '0 0 8px 0'
  } as React.CSSProperties,

  alertTime: {
    fontSize: '11px',
    color: '#999',
    margin: 0
  } as React.CSSProperties,

  detailsBox: {
    backgroundColor: '#f5f5f5',
    padding: '16px',
    borderRadius: '4px',
    fontSize: '13px',
    lineHeight: '1.6'
  } as React.CSSProperties,

  violationsList: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #ddd'
  } as React.CSSProperties,

  violationItem: {
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #eee'
  } as React.CSSProperties,

  remediation: {
    color: '#2196F3',
    marginTop: '4px',
    fontStyle: 'italic'
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    padding: '48px 24px',
    color: '#999'
  },

  smallText: {
    fontSize: '12px',
    marginTop: '8px'
  } as React.CSSProperties
};

export default IntegrityDashboard;
