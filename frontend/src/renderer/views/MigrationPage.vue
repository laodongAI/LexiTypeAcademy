<!--
  数据迁移页面
  
  导入/导出学习数据
-->

<template>
  <div class="migration-page">
    <el-row :gutter="24">
      <!-- 导入数据 -->
      <el-col :span="12">
        <el-card class="migration-card">
          <template #header>
            <div class="card-header">
              <el-icon :size="24"><Upload /></el-icon>
              <span>导入数据</span>
            </div>
          </template>
          
          <div class="card-content">
            <p class="description">
              从备份文件或其他学习软件导入你的学习数据
            </p>
            
            <el-upload
              class="upload-area"
              drag
              action="#"
              :auto-upload="false"
              :on-change="handleFileChange"
              accept=".json,.csv,.xlsx"
            >
              <el-icon class="el-icon--upload" :size="48"><Upload /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 JSON、CSV、XLSX 格式文件
                </div>
              </template>
            </el-upload>
            
            <div v-if="importFile" class="file-info">
              <el-icon><Document /></el-icon>
              <span>{{ importFile.name }}</span>
              <el-button text type="danger" @click="clearImportFile">
                移除
              </el-button>
            </div>
            
            <el-button 
              type="primary" 
              :loading="isImporting"
              :disabled="!importFile"
              @click="importData"
            >
              开始导入
            </el-button>
          </div>
        </el-card>
      </el-col>
      
      <!-- 导出数据 -->
      <el-col :span="12">
        <el-card class="migration-card">
          <template #header>
            <div class="card-header">
              <el-icon :size="24"><Download /></el-icon>
              <span>导出数据</span>
            </div>
          </template>
          
          <div class="card-content">
            <p class="description">
              将你的学习数据导出为备份文件
            </p>
            
            <el-form label-width="100px">
              <el-form-item label="导出格式">
                <el-select v-model="exportFormat" placeholder="选择格式">
                  <el-option label="JSON 格式" value="json" />
                  <el-option label="CSV 格式" value="csv" />
                  <el-option label="Excel 格式" value="xlsx" />
                </el-select>
              </el-form-item>
              
              <el-form-item label="导出内容">
                <el-checkbox-group v-model="exportContent">
                  <el-checkbox value="courses">课程进度</el-checkbox>
                  <el-checkbox value="vocabulary">词汇数据</el-checkbox>
                  <el-checkbox value="history">学习历史</el-checkbox>
                  <el-checkbox value="settings">设置</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </el-form>
            
            <el-button 
              type="primary" 
              :loading="isExporting"
              :disabled="exportContent.length === 0"
              @click="exportData"
            >
              开始导出
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 迁移历史 -->
    <el-card class="history-card">
      <template #header>
        <span>迁移历史</span>
      </template>
      
      <el-table :data="migrationHistory" stripe>
        <el-table-column prop="date" label="日期" width="180" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'import' ? 'success' : 'primary'">
              {{ row.type === 'import' ? '导入' : '导出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fileName" label="文件名" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="大小" width="120" />
      </el-table>
      
      <el-empty v-if="migrationHistory.length === 0" description="暂无迁移记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload, Download, Document } from '@element-plus/icons-vue'

// 导入相关
const importFile = ref<File | null>(null)
const isImporting = ref(false)

// 导出相关
const exportFormat = ref('json')
const exportContent = ref(['courses', 'vocabulary', 'history'])
const isExporting = ref(false)

// 迁移历史
const migrationHistory = ref([
  { 
    date: '2024-01-15 14:30', 
    type: 'export', 
    fileName: 'backup_20240115.json',
    status: 'success',
    size: '1.2 MB',
  },
  { 
    date: '2024-01-10 10:00', 
    type: 'import', 
    fileName: 'data.csv',
    status: 'success',
    size: '856 KB',
  },
])

// 处理文件选择
import type { UploadFile } from 'element-plus'

function handleFileChange(uploadFile: UploadFile) {
  if (uploadFile.raw) {
    importFile.value = uploadFile.raw
  }
}

// 清除导入文件
function clearImportFile() {
  importFile.value = null
}

// 导入数据
async function importData() {
  if (!importFile.value) return
  
  isImporting.value = true
  try {
    // TODO: 实现实际的导入逻辑
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    migrationHistory.value.unshift({
      date: new Date().toLocaleString(),
      type: 'import',
      fileName: importFile.value.name,
      status: 'success',
      size: `${(importFile.value.size / 1024).toFixed(1)} KB`,
    })
    
    ElMessage.success('数据导入成功')
    importFile.value = null
  } catch (error) {
    ElMessage.error('数据导入失败')
  } finally {
    isImporting.value = false
  }
}

// 导出数据
async function exportData() {
  if (exportContent.value.length === 0) return
  
  isExporting.value = true
  try {
    // TODO: 实现实际的导出逻辑
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const fileName = `backup_${Date.now()}.${exportFormat.value}`
    
    migrationHistory.value.unshift({
      date: new Date().toLocaleString(),
      type: 'export',
      fileName,
      status: 'success',
      size: '1.5 MB',
    })
    
    ElMessage.success('数据导出成功')
  } catch (error) {
    ElMessage.error('数据导出失败')
  } finally {
    isExporting.value = false
  }
}
</script>

<style lang="scss" scoped>
.migration-page {
  max-width: 1200px;
  margin: 0 auto;
}

.migration-card {
  margin-bottom: 24px;
  
  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .el-icon {
      color: var(--primary-color);
    }
  }
}

.card-content {
  .description {
    margin: 0 0 24px 0;
    color: var(--text-color-secondary);
  }
}

.upload-area {
  margin-bottom: 24px;
  
  :deep(.el-upload-dragger) {
    width: 100%;
  }
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--bg-color-hover);
  border-radius: 8px;
  margin-bottom: 24px;
  
  .el-icon {
    color: var(--primary-color);
  }
  
  span {
    flex: 1;
  }
}

.history-card {
  margin-top: 24px;
}
</style>
