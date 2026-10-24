<template>
  <div class="diagnostics-page">
    <header class="page-header">
      <div><h2>运行诊断日志</h2><p>查看前端异常、后端请求失败和运行状态。最近 1000 条日志会在刷新后保留。</p></div>
      <div class="actions"><el-button @click="refresh">刷新</el-button><el-button :disabled="filtered.length === 0" @click="exportLogs">导出 JSON</el-button><el-button type="danger" plain @click="clearLogs">清空日志</el-button></div>
    </header>
    <el-alert type="info" show-icon :closable="false" title="隐私说明" description="日志仅保留诊断摘要，不记录请求正文、密码、模型密钥或完整学习内容。导出前请检查详情。" />
    <el-row :gutter="12" class="summary">
      <el-col :xs="12" :sm="6"><el-card shadow="never"><strong>{{ logs.length }}</strong><span>全部记录</span></el-card></el-col>
      <el-col :xs="12" :sm="6"><el-card shadow="never"><strong>{{ count('error') }}</strong><span>错误</span></el-card></el-col>
      <el-col :xs="12" :sm="6"><el-card shadow="never"><strong>{{ count('warn') }}</strong><span>警告</span></el-card></el-col>
      <el-col :xs="12" :sm="6"><el-card shadow="never"><strong>{{ apiFailures }}</strong><span>接口失败</span></el-card></el-col>
    </el-row>
    <el-card shadow="never">
      <div class="filters"><el-input v-model="query" clearable placeholder="搜索来源、事件或详情" /><el-select v-model="level" clearable placeholder="全部级别"><el-option label="调试" value="debug" /><el-option label="信息" value="info" /><el-option label="警告" value="warn" /><el-option label="错误" value="error" /></el-select><el-select v-model="source" clearable placeholder="全部来源"><el-option v-for="item in sources" :key="item" :label="item" :value="item" /></el-select></div>
      <el-table :data="filtered" row-key="id" stripe>
        <el-table-column label="时间" width="180"><template #default="{ row }">{{ formatTime(row.timestamp) }}</template></el-table-column>
        <el-table-column label="级别" width="90"><template #default="{ row }"><el-tag :type="tagType(row.level)" size="small">{{ label(row.level) }}</el-tag></template></el-table-column>
        <el-table-column prop="source" label="来源" width="130" />
        <el-table-column label="事件" min-width="260"><template #default="{ row }"><div class="message">{{ row.message }}</div><details v-if="row.details"><summary>查看详情</summary><pre>{{ row.details }}</pre></details></template></el-table-column>
      </el-table>
      <el-empty v-if="!filtered.length" description="没有匹配的日志。重现问题后可刷新查看。" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { clearDiagnosticLogs, getDiagnosticLogs, subscribeDiagnosticLogs, type DiagnosticLevel, type DiagnosticLogEntry } from '../../shared/services/diagnosticLogService'
const logs = ref<DiagnosticLogEntry[]>([])
const query = ref('')
const level = ref<DiagnosticLevel | ''>('')
const source = ref('')
let unsubscribe: (() => void) | undefined
const sources = computed(() => [...new Set(logs.value.map((item) => item.source))].sort())
const filtered = computed(() => {
  const q = query.value.trim().toLocaleLowerCase()
  return logs.value.filter((item) => (!level.value || item.level === level.value) && (!source.value || item.source === source.value) && (!q || [item.source, item.message, item.details || ''].some((v) => v.toLocaleLowerCase().includes(q))))
})
const apiFailures = computed(() => logs.value.filter((item) => item.source === 'api' && item.level === 'error').length)
function refresh() { logs.value = getDiagnosticLogs() }
function count(target: DiagnosticLevel) { return logs.value.filter((item) => item.level === target).length }
function formatTime(value: number) { return new Date(value).toLocaleString() }
function label(value: DiagnosticLevel) { return ({ debug: '调试', info: '信息', warn: '警告', error: '错误' })[value] }
function tagType(value: DiagnosticLevel): 'info' | 'success' | 'warning' | 'danger' { if (value === 'error') return 'danger'; if (value === 'warn') return 'warning'; if (value === 'debug') return 'info'; return 'success' }
function exportLogs() { const blob = new Blob([JSON.stringify(filtered.value, null, 2)], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'lexitype-diagnostics-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'; link.click(); URL.revokeObjectURL(url); ElMessage.success('已导出当前筛选日志') }
async function clearLogs() { try { await ElMessageBox.confirm('确定清空本地诊断日志？此操作不可撤销。', '清空日志', { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' }); clearDiagnosticLogs(); refresh(); ElMessage.success('日志已清空') } catch { /* 用户取消 */ } }
onMounted(() => { refresh(); unsubscribe = subscribeDiagnosticLogs(refresh) })
onUnmounted(() => unsubscribe?.())
</script>

<style scoped lang="scss">
.diagnostics-page { max-width: 1280px; margin: 0 auto; }
.page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; }
.page-header h2 { margin:0 0 8px; font-size:28px; color:var(--text-color); }
.page-header p { margin:0; color:var(--text-color-secondary); line-height:1.5; }
.actions { display:flex; flex-wrap:wrap; gap:8px; }
.summary { margin:16px 0; }
.summary :deep(.el-card__body) { display:flex; align-items:baseline; gap:10px; }
.summary strong { font-size:24px; color:var(--text-color); }
.summary span { font-size:13px; color:var(--text-color-secondary); }
.filters { display:grid; grid-template-columns:minmax(220px, 1fr) 150px 180px; gap:12px; margin-bottom:16px; }
.message { white-space:pre-wrap; overflow-wrap:anywhere; }
details { margin-top:6px; color:var(--text-color-secondary); }
summary { cursor:pointer; font-size:12px; }
pre { white-space:pre-wrap; overflow-wrap:anywhere; max-height:240px; overflow:auto; padding:10px; background:var(--bg-color); border-radius:6px; }
@media (max-width:760px) { .page-header { flex-direction:column; } .filters { grid-template-columns:1fr; } }
</style>
