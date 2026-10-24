/**
 * 课程体系（教材导入）缓存存储
 *
 * 从老版本 courseSystemStore 迁移：用于缓存 publisher -> series -> textbooks -> units。
 *
 * 注意：这里使用 localStorage（renderer 侧），避免频繁调用 AI。
 */

export interface TextbookMeta {
  grade: string;
  semester: string;
  name: string;
}

export interface TextbookUnitMeta {
  unit_num: number;
  title: string;
  topics: string[];
  generated?: boolean;
  generatedTypes?: string[];
}

const STORAGE_KEY = 'course_system_data_v1';

interface CourseSystemData {
  series: Record<string, string[]>;
  textbooks: Record<string, TextbookMeta[]>;
  units: Record<string, TextbookUnitMeta[]>;
}

class CourseSystemStore {
  private data: CourseSystemData;

  constructor() {
    this.data = this.load();
  }

  private load(): CourseSystemData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.series) parsed.series = {};
        if (!parsed.textbooks) parsed.textbooks = {};
        if (!parsed.units) parsed.units = {};
        return parsed;
      }
    } catch (e) {
      console.error('加载课程体系缓存失败', e);
    }
    return { series: {}, textbooks: {}, units: {} };
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('保存课程体系缓存失败', e);
    }
  }

  getSeries(publisher: string): string[] | null {
    return this.data.series[publisher] || null;
  }

  saveSeries(publisher: string, series: string[]) {
    this.data.series[publisher] = series;
    this.save();
  }

  clearSeries(publisher: string) {
    if (this.data.series[publisher]) {
      delete this.data.series[publisher];
      this.save();
    }
  }

  getTextbooks(publisher: string, series: string, grade?: string): TextbookMeta[] | null {
    const key = grade ? `${publisher}|${series}|${grade}` : `${publisher}|${series}`;
    return this.data.textbooks[key] || null;
  }

  saveTextbooks(publisher: string, series: string, textbooks: TextbookMeta[], grade?: string) {
    const key = grade ? `${publisher}|${series}|${grade}` : `${publisher}|${series}`;
    this.data.textbooks[key] = textbooks;
    this.save();
  }

  clearTextbooks(publisher: string, series: string, grade?: string) {
    const key = grade ? `${publisher}|${series}|${grade}` : `${publisher}|${series}`;
    if (this.data.textbooks[key]) {
      delete this.data.textbooks[key];
      this.save();
    }
  }

  private unitsKey(publisher: string, series: string, textbookName: string, grade?: string): string {
    return grade ? `${publisher}|${series}|${grade}|${textbookName}` : `${publisher}|${series}|${textbookName}`;
  }

  getUnits(publisher: string, series: string, textbookName: string, grade?: string): TextbookUnitMeta[] | null {
    const key = this.unitsKey(publisher, series, textbookName, grade);
    // Never reuse an unscoped legacy unit cache for a grade-scoped request: it may belong to another edition.
    return this.data.units[key] || null;
  }

  saveUnits(publisher: string, series: string, textbookName: string, units: TextbookUnitMeta[], grade?: string) {
    const key = this.unitsKey(publisher, series, textbookName, grade);
    this.data.units[key] = units;
    this.save();
  }

  clearUnits(publisher: string, series: string, textbookName: string, grade?: string) {
    const key = this.unitsKey(publisher, series, textbookName, grade);
    const legacyKey = this.unitsKey(publisher, series, textbookName);
    if (this.data.units[key] || this.data.units[legacyKey]) {
      delete this.data.units[key];
      delete this.data.units[legacyKey];
      this.save();
    }
  }

  markUnitTypeAsGenerated(publisher: string, series: string, textbookName: string, unitTitle: string, contentType: string, grade?: string) {
    const key = this.unitsKey(publisher, series, textbookName, grade);
    const units = this.data.units[key];
    if (!units) return;
    const unit = units.find(item => item.title === unitTitle);
    if (!unit) return;
    const types = new Set(unit.generatedTypes || []);
    types.add(contentType);
    unit.generatedTypes = [...types];
    unit.generated = unit.generatedTypes.length > 0;
    this.save();
  }

  markUnitAsGenerated(publisher: string, series: string, textbookName: string, unitTitle: string, grade?: string) {
    const key = this.unitsKey(publisher, series, textbookName, grade);
    const units = this.data.units[key];
    if (units) {
      const unit = units.find(u => u.title === unitTitle);
      if (unit) {
        unit.generated = true;
        this.save();
      }
    }
  }

  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importData(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed.textbooks === 'object' && typeof parsed.units === 'object') {
        this.data = {
          series: { ...this.data.series, ...(parsed.series || {}) },
          textbooks: { ...this.data.textbooks, ...parsed.textbooks },
          units: { ...this.data.units, ...parsed.units }
        };
        this.save();
        return true;
      }
    } catch (e) {
      console.error('导入课程体系缓存失败', e);
    }
    return false;
  }

  clearAll() {
    this.data = { series: {}, textbooks: {}, units: {} };
    this.save();
  }
}

export const courseSystemStore = new CourseSystemStore();
