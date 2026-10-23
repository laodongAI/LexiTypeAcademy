import { contextBridge } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Store from 'electron-store';

const store = new Store({ name: 'typing-data' });

// ---------- History ----------
function getHistory() { return store.get('history', []); }
function addRecord(record) {
  const history = store.get('history', []);
  history.push(record);
  store.set('history', history);
  return history;
}

// ---------- Settings ----------
function getSetting(key, defaultValue) { return store.get(`settings.${key}`, defaultValue); }
function setSetting(key, value) { store.set(`settings.${key}`, value); }

// ---------- Courses ----------
function getCourses() { return store.get('courses', []); }
function saveCourse(course) {
  const courses = store.get('courses', []);
  const idx = courses.findIndex(c => c.id === course.id);
  if (idx >= 0) courses[idx] = course; else courses.push(course);
  store.set('courses', courses);
  return course;
}
function deleteCourse(id) {
  const courses = store.get('courses', []);
  const updated = courses.filter(c => c.id !== id);
  store.set('courses', updated);
  return updated;
}

contextBridge.exposeInMainWorld('typingAPI', {
  // history
  getHistory,
  addRecord,
  // settings
  getSetting,
  setSetting,
  // courses
  getCourses,
  saveCourse,
  deleteCourse,
  // export history CSV
  exportHistoryCSV: () => {
    const history = getHistory();
    const header = 'date,practiceType,difficulty,wpm,accuracy\n';
    const rows = history.map(r => [r.date, r.practiceType, r.difficulty, r.wpm, r.accuracy].join(',')).join('\n');
    const csv = header + rows;
    const dir = os.homedir();
    const file = path.join(dir, `typing-history-${Date.now()}.csv`);
    try {
      fs.writeFileSync(file, csv, 'utf-8');
      return file;
    } catch (e) {
      return null;
    }
  },
  // export analytics CSV (including mastery)
  exportAnalyticsCSV: (masteryStats) => {
    const history = getHistory();
    const header = 'date,practiceType,difficulty,wpm,accuracy\n';
    const rows = history.map(r => [r.date, r.practiceType, r.difficulty, r.wpm, r.accuracy].join(',')).join('\n');
    
    const masteryHeader = '\n\nMastery Stats\nTotal,Mastered,Learning,Due\n';
    const masteryRow = `${masteryStats.total},${masteryStats.mastered},${masteryStats.learning},${masteryStats.due}\n`;

    const csv = header + rows + masteryHeader + masteryRow;
    const dir = os.homedir();
    const file = path.join(dir, `lexitype-analytics-${Date.now()}.csv`);
    try {
      fs.writeFileSync(file, csv, 'utf-8');
      return file;
    } catch (e) {
      return null;
    }
  }
});
