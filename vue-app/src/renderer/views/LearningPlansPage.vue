<!--
  学习计划页面

  目的：
  - 参照 uidesigen 原型的 Learning Plans 页面，提供统一的页面层级（header + cards/empty state）
  - 当前版本仅提供 UI 与导航挂载；学习计划数据模型与调度引擎尚未实现（见 docs/MIGRATION_PLAN_AND_DEVELOPMENT_ROADMAP.md 任务 12）

  注意：
  - 不引入假数据；避免“看起来可用但实际无数据源”的误导
-->

<template>
  <div class="learning-plans-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">学习计划</h2>
        <p class="page-subtitle">把课程组织成有目标的学习路径（规划中）。</p>
      </div>
    </header>

    <section class="settings-section settings-section-last">
      <div class="section-header">
        <h3 class="section-title">计划列表</h3>
      </div>

      <el-empty description="学习计划功能正在开发中">
        <el-button type="primary" @click="goMyLearning">返回我的学习</el-button>
      </el-empty>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goMyLearning() {
  router.push('/my-learning')
}
</script>

<style lang="scss" scoped>
.learning-plans-page {
  max-width: 800px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 28px;
}

.page-title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 300;
  letter-spacing: -0.02em;
  color: var(--text-color);
}

.page-subtitle {
  margin: 0;
  font-size: 16px;
  font-weight: 300;
  color: var(--text-color-secondary);
}

.settings-section {
  padding: 0 0 28px;
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: 28px;
}

.settings-section-last {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-header {
  padding-bottom: 12px;
}

.section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-color-secondary);
}
</style>
