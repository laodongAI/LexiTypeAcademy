/**
 * 事件源仪表板
 * 展示事件流可视化、统计分析、一致性检查和性能监控
 */

import React, { useState, useEffect } from 'react';

/**
 * 事件项目样式
 */
const eventItemStyles: React.CSSProperties = {
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  padding: '12px',
  marginBottom: '8px',
  backgroundColor: '#fafafa',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
};

/**
 * 选中事件项目样式
 */
const selectedEventStyles: React.CSSProperties = {
  ...eventItemStyles,
  backgroundColor: '#e3f2fd',
  borderColor: '#2196F3',
  boxShadow: '0 2px 4px rgba(33, 150, 243, 0.3)',
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
  <div style={{
    backgroundColor: '#fff',
    border: `2px solid ${color}`,
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    flex: '1',
    minWidth: '140px',
    marginRight: '8px',
  }}>
    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
      {title}
    </div>
    <div style={{ fontSize: '28px', fontWeight: 'bold', color }}>
      {value}
    </div>
    {percentage && (
      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
        {percentage}
      </div>
    )}
    {label && (
      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
        {label}
      </div>
    )}
  </div>
);

/**
 * 事件时间线项目组件
 */
interface EventTimelineItemProps {
  eventId: string;
  eventType: string;
  version: number;
  timestamp: Date;
  isSelected: boolean;
  onClick: () => void;
}

const EventTimelineItem: React.FC<EventTimelineItemProps> = ({
  eventId,
  eventType,
  version,
  timestamp,
  isSelected,
  onClick,
}) => {
  const timeStr = new Date(timestamp).toLocaleTimeString('zh-CN');
  const dateStr = new Date(timestamp).toLocaleDateString('zh-CN');

  return (
    <div
      style={isSelected ? selectedEventStyles : eventItemStyles}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.backgroundColor = '#fafafa';
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {eventType}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            v{version} • {dateStr} {timeStr}
          </div>
        </div>
        <div style={{ fontSize: '11px', color: '#999', textAlign: 'right' }}>
          {eventId.substring(0, 12)}...
        </div>
      </div>
    </div>
  );
};

/**
 * 事件源仪表板主组件
 */
export const EventSourcingDashboard: React.FC = () => {
  // 状态定义
  const [aggregateId, setAggregateId] = useState<string>('');
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [health, setHealth] = useState<any | null>(null);
  const [replayProgress, setReplayProgress] = useState<number>(0);
  const [showReplayModal, setShowReplayModal] = useState<boolean>(false);
  const [consistencyIssues, setConsistencyIssues] = useState<any[]>([]);
  const [snapshotInfo, setSnapshotInfo] = useState<any | null>(null);

  /**
   * 加载事件流
   */
  const handleLoadEvents = async () => {
    if (!aggregateId.trim()) {
      setError('请输入聚合根 ID');
      return;
    }

    setIsLoading(true);
    setError('');
    setEvents([]);
    setSelectedEvent(null);

    try {
      console.log(`📊 [Dashboard] 加载事件流: ${aggregateId}`);
      
      // 这里将与 EventStore 交互
      // 模拟加载数据
      setTimeout(() => {
        const mockEvents = Array.from({ length: 10 }, (_, i) => ({
          eventId: `evt-${Date.now()}-${i}`,
          eventType: ['AggregateCreatedEvent', 'PropertyChangedEvent', 'StatusUpdatedEvent'][i % 3],
          version: i + 1,
          timestamp: new Date(Date.now() - (10 - i) * 60000),
          payload: { data: `事件 ${i + 1}` },
        }));

        setEvents(mockEvents);
        
        // 模拟统计信息
        setStats({
          totalEvents: mockEvents.length,
          currentVersion: mockEvents.length,
          firstEventTime: mockEvents[0].timestamp,
          lastEventTime: mockEvents[mockEvents.length - 1].timestamp,
          eventTypeDistribution: {
            'AggregateCreatedEvent': 4,
            'PropertyChangedEvent': 3,
            'StatusUpdatedEvent': 3,
          },
          sourceDistribution: {
            'USER': 6,
            'SYSTEM': 4,
          },
          hasSnapshot: true,
          latestSnapshotVersion: 7,
        });

        // 模拟快照信息
        setSnapshotInfo({
          version: 7,
          createdAt: new Date(Date.now() - 300000),
          size: 2048,
        });

        // 模拟健康检查
        setHealth({
          healthScore: 85,
          status: 'healthy',
          recommendations: ['考虑定期创建快照', '事件流过长，可考虑分割'],
        });
      }, 500);
    } catch (err) {
      setError(`加载失败: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 检查一致性
   */
  const handleCheckConsistency = async () => {
    if (!aggregateId.trim()) {
      setError('请输入聚合根 ID');
      return;
    }

    setIsLoading(true);

    try {
      console.log(`🔍 [Dashboard] 检查一致性: ${aggregateId}`);
      
      // 模拟一致性检查
      setTimeout(() => {
        setConsistencyIssues([
          {
            type: 'metadata_missing',
            severity: 'warning',
            description: '事件 5 缺少用户 ID 元数据',
            affectedVersion: 5,
          },
        ]);
      }, 500);
    } catch (err) {
      setError(`一致性检查失败: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 模拟重放
   */
  const handleReplay = () => {
    setShowReplayModal(true);
    setReplayProgress(0);

    const interval = setInterval(() => {
      setReplayProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  /**
   * 导出事件
   */
  const handleExportEvents = () => {
    if (events.length === 0) {
      setError('没有事件可导出');
      return;
    }

    const dataStr = JSON.stringify(events, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events-${aggregateId}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 8px 0' }}>事件源仪表板</h1>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          事件流可视化、统计分析、一致性检查和性能监控
        </p>
      </div>

      {/* 聚合根输入 */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold' }}>聚合根 ID：</label>
          <input
            type="text"
            value={aggregateId}
            onChange={(e) => setAggregateId(e.target.value)}
            placeholder="输入聚合根 ID..."
            style={{
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              flex: 1,
              maxWidth: '400px',
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleLoadEvents()}
          />
          <button
            onClick={handleLoadEvents}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196F3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? '加载中...' : '加载事件流'}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{
          backgroundColor: '#ffebee',
          border: '1px solid #ef5350',
          color: '#c62828',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* 统计卡片 */}
      {stats && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}>
          <StatCard
            title="总事件数"
            value={stats.totalEvents}
            color="#2196F3"
          />
          <StatCard
            title="当前版本"
            value={stats.currentVersion}
            color="#4CAF50"
          />
          <StatCard
            title="快照版本"
            value={stats.latestSnapshotVersion || 0}
            color="#FF9800"
          />
          <StatCard
            title="事件类型"
            value={Object.keys(stats.eventTypeDistribution).length}
            color="#9C27B0"
          />
        </div>
      )}

      {/* 健康状态 */}
      {health && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <h3 style={{ margin: '0 0 12px 0' }}>流健康状态</h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px',
          }}>
            <div style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: health.healthScore >= 80 ? '#4CAF50' : health.healthScore >= 50 ? '#FF9800' : '#F44336',
              marginRight: '16px',
            }}>
              {health.healthScore}
            </div>
            <div>
              <div style={{ fontWeight: 'bold' }}>
                状态: {health.status === 'healthy' ? '✅ 健康' : health.status === 'warning' ? '⚠️ 警告' : '❌ 严重'}
              </div>
              {health.recommendations.length > 0 && (
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                  建议: {health.recommendations.join('; ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 主内容区域 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '20px',
      }}>
        {/* 事件时间线 */}
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px',
        }}>
          <h3 style={{ margin: '0 0 12px 0' }}>事件时间线</h3>
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
          }}>
            {events.length === 0 ? (
              <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                无事件数据
              </div>
            ) : (
              events.map((event, idx) => (
                <EventTimelineItem
                  key={idx}
                  eventId={event.eventId}
                  eventType={event.eventType}
                  version={event.version}
                  timestamp={event.timestamp}
                  isSelected={selectedEvent?.eventId === event.eventId}
                  onClick={() => setSelectedEvent(event)}
                />
              ))
            )}
          </div>
        </div>

        {/* 事件详情 */}
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px',
        }}>
          <h3 style={{ margin: '0 0 12px 0' }}>事件详情</h3>
          {selectedEvent ? (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontWeight: 'bold', color: '#666' }}>事件 ID：</label>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#999' }}>
                  {selectedEvent.eventId}
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontWeight: 'bold', color: '#666' }}>事件类型：</label>
                <div>{selectedEvent.eventType}</div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontWeight: 'bold', color: '#666' }}>版本：</label>
                <div>{selectedEvent.version}</div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontWeight: 'bold', color: '#666' }}>时间：</label>
                <div>{new Date(selectedEvent.timestamp).toLocaleString('zh-CN')}</div>
              </div>
              <div>
                <label style={{ fontWeight: 'bold', color: '#666' }}>负载：</label>
                <pre style={{
                  backgroundColor: '#f5f5f5',
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontSize: '12px',
                }}>
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
              选择事件查看详情
            </div>
          )}
        </div>
      </div>

      {/* 快照信息 */}
      {snapshotInfo && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <h3 style={{ margin: '0 0 12px 0' }}>快照信息</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#666' }}>快照版本：</label>
              <div>v{snapshotInfo.version}</div>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#666' }}>快照大小：</label>
              <div>{(snapshotInfo.size / 1024).toFixed(2)} KB</div>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#666' }}>创建时间：</label>
              <div>{new Date(snapshotInfo.createdAt).toLocaleString('zh-CN')}</div>
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#666' }}>优化效果：</label>
              <div>快速加载 (跳过 {stats?.currentVersion - snapshotInfo.version} 个事件)</div>
            </div>
          </div>
        </div>
      )}

      {/* 一致性问题 */}
      {consistencyIssues.length > 0 && (
        <div style={{
          backgroundColor: '#fff3e0',
          border: '1px solid #ff9800',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#e65100' }}>⚠️ 检测到一致性问题</h3>
          <div>
            {consistencyIssues.map((issue, idx) => (
              <div key={idx} style={{
                backgroundColor: '#fff',
                padding: '8px 12px',
                borderRadius: '4px',
                marginBottom: '8px',
                borderLeft: `4px solid ${issue.severity === 'critical' ? '#F44336' : issue.severity === 'error' ? '#FF9800' : '#FFC107'}`,
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {issue.type} ({issue.severity})
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {issue.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={handleCheckConsistency}
          disabled={isLoading || events.length === 0}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          🔍 检查一致性
        </button>
        <button
          onClick={handleReplay}
          disabled={events.length === 0}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: events.length === 0 ? 'not-allowed' : 'pointer',
            opacity: events.length === 0 ? 0.6 : 1,
          }}
        >
          🔄 模拟重放
        </button>
        <button
          onClick={handleExportEvents}
          disabled={events.length === 0}
          style={{
            padding: '8px 16px',
            backgroundColor: '#9C27B0',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: events.length === 0 ? 'not-allowed' : 'pointer',
            opacity: events.length === 0 ? 0.6 : 1,
          }}
        >
          💾 导出事件
        </button>
      </div>

      {/* 重放进度模态框 */}
      {showReplayModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>事件重放进度</h3>
            <div style={{
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              height: '8px',
              marginBottom: '12px',
              overflow: 'hidden',
            }}>
              <div style={{
                backgroundColor: '#2196F3',
                height: '100%',
                width: `${replayProgress}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ textAlign: 'center', color: '#666', marginBottom: '16px' }}>
              {replayProgress}% 完成
            </div>
            {replayProgress === 100 && (
              <div style={{
                backgroundColor: '#e8f5e9',
                color: '#2e7d32',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '16px',
                textAlign: 'center',
              }}>
                ✅ 重放完成！成功应用所有事件
              </div>
            )}
            <button
              onClick={() => setShowReplayModal(false)}
              style={{
                width: '100%',
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
