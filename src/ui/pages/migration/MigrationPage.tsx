/**
 * 数据迁移管理页面
 * 
 * 提供可视化界面来执行和监控课程数据迁移
 */

import React from 'react';
import { useMigration } from '@/app/hooks/useMigration';

export const MigrationPage: React.FC = () => {
  const {
    isRunning,
    isComplete,
    result,
    validation,
    stats,
    error,
    runMigration,
    refreshStats,
    reset
  } = useMigration();
  
  // 首次加载时刷新统计
  React.useEffect(() => {
    refreshStats();
  }, [refreshStats]);
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="text-4xl">🗄️</span>
            课程数据迁移
          </h1>
          <p className="text-gray-600">
            将现有课程升级到新的数据模型，支持权限控制和分类管理
          </p>
        </div>
        
        {/* 当前统计 */}
        {stats && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">当前数据统计</h2>
              <button
                onClick={refreshStats}
                disabled={isRunning}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span className="text-lg">🔄</span>
                刷新
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">总课程数</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.editable}</div>
                <div className="text-sm text-gray-600">可编辑</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{stats.readonly}</div>
                <div className="text-sm text-gray-600">只读</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {Object.keys(stats.bySource).length}
                </div>
                <div className="text-sm text-gray-600">来源类型</div>
              </div>
            </div>
            
            {/* 详细统计 */}
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">按来源分类</h3>
                <div className="space-y-2">
                  {Object.entries(stats.bySource).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{getSourceTypeLabel(type)}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 mb-2">按状态分类</h3>
                <div className="space-y-2">
                  {Object.entries(stats.byStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{getStatusLabel(status)}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 迁移控制 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">迁移操作</h2>
          
          {!isComplete ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">迁移说明</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>为现有课程添加来源类型和权限信息</li>
                  <li>AI 生成的课程将设置为只读，不可编辑</li>
                  <li>用户创建和导入的课程可完全编辑</li>
                  <li>已迁移的课程将自动跳过</li>
                </ul>
              </div>
              
              <button
                onClick={runMigration}
                disabled={isRunning}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium
                          hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                          flex items-center justify-center gap-2"
              >
                {isRunning ? (
                  <>
                    <span className="text-xl animate-spin inline-block">⚙️</span>
                    迁移中...
                  </>
                ) : (
                  <>
                    <span className="text-xl">▶️</span>
                    开始迁移
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 迁移结果 */}
              {result && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="text-2xl">✅</span>
                    <span className="font-medium">迁移完成</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded">
                      <div className="text-2xl font-bold text-green-600">{result.success}</div>
                      <div className="text-sm text-gray-600">成功</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-2xl font-bold text-gray-600">{result.skipped}</div>
                      <div className="text-sm text-gray-600">跳过</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded">
                      <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                      <div className="text-sm text-gray-600">失败</div>
                    </div>
                  </div>
                  
                  {result.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-medium text-red-900 mb-2">错误列表</h4>
                      <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                        {result.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {/* 验证结果 */}
              {validation && (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 ${validation.valid ? 'text-green-600' : 'text-orange-600'}`}>
                    <span className="text-2xl">
                      {validation.valid ? '✅' : '⚠️'}
                    </span>
                    <span className="font-medium">
                      {validation.valid ? '数据验证通过' : '发现数据问题'}
                    </span>
                  </div>
                  
                  {!validation.valid && validation.issues.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-medium text-orange-900 mb-2">问题列表</h4>
                      <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                        {validation.issues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <button
                onClick={reset}
                className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg font-medium
                          hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                <span className="text-xl">🔄</span>
                重置并再次迁移
              </button>
            </div>
          )}
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <span className="text-2xl text-red-600 flex-shrink-0">❌</span>
            <div>
              <h3 className="font-medium text-red-900">迁移失败</h3>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 获取来源类型标签
 */
function getSourceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    system: '系统预设',
    ai_generated: 'AI 生成',
    user_created: '用户创建',
    imported: '导入课程',
    audio_import: '音频导入',
    material_parsed: '教材解析',
    unknown: '未知'
  };
  return labels[type] || type;
}

/**
 * 获取状态标签
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '活跃',
    archived: '已归档',
    draft: '草稿',
    unknown: '未知'
  };
  return labels[status] || status;
}
