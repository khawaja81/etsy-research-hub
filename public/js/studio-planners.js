import { esc } from './ui.js';
import { col, head, sec, ruled, todo, numbered, row, table, DAYS, MONTHS } from './studio-core.js';

/*
 * Planner & tracker layouts. Every layout is fixed code — no AI. All lists are plain
 * starting points the seller edits. Undated unless a month/year is chosen.
 */

const num = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || d));
const hr = (h) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);
const sel = (id, label, options, def) => ({ id, label, type: 'select', options, def });
const monthOptions = MONTHS.map((m, i) => [String(i), m]);
const startOptions = [['1', 'Monday'], ['0', 'Sunday']];
const rotDays = (start) => Array.from({ length: 7 }, (_, i) => DAYS[(Number(start) + i) % 7]);
const dim = (y, m) => new Date(y, m + 1, 0).getDate();

export const PLANNERS = {
  daily: {
    group: 'Planners', label: 'Daily planner', emoji: '📅', query: 'daily planner printable', note: 'Priorities, hourly schedule, to-do, water and mood.',
    fields: [
      { id: 'title', label: 'Title', def: 'Daily Planner' },
      sel('layout', 'Layout', [['hourly', 'Hourly schedule'], ['simple', 'Priorities & to-do (no hours)']], 'hourly'),
      { id: 'startH', label: 'Day starts (hour, 0–23)', type: 'number', def: 6 },
      { id: 'endH', label: 'Day ends (hour, 1–24)', type: 'number', def: 21 },
    ],
    presets: {},
    build(v) {
      const s = num(v.startH, 6, 0, 22), e = Math.max(s + 4, num(v.endH, 21, 1, 24));
      const hours = Array.from({ length: e - s }, (_, i) => `<div style="flex:1;display:flex;gap:8px;align-items:end;border-bottom:1px solid var(--line);font-size:10px"><span style="width:.5in;color:var(--acc);font-weight:600">${hr(s + i)}</span></div>`).join('');
      const drops = Array.from({ length: 8 }, () => '<span class="circ"></span>').join(' ');
      const left = v.layout === 'hourly' ? sec('Priorities', numbered(3), 0.6) + sec('Schedule', `<div style="flex:1;display:flex;flex-direction:column">${hours}</div>`, 3)
        : sec('Top priorities', numbered(5), 1) + sec('Schedule / appointments', ruled, 1.4);
      const right = sec('To-do', todo(v.layout === 'hourly' ? 9 : 12), 2) + sec('Notes', ruled, 1.4) + sec('Water', `<div style="padding:4px 0">${drops}</div>`, 0.35) + sec('Mood', '<div style="display:flex;gap:10px;padding:3px 0"><span class="circ"></span><span class="circ"></span><span class="circ"></span><span class="circ"></span><span class="circ"></span></div>', 0.35);
      return [col(head(v.title, 'Date: ____________________') + row(`<div style="flex:1.1;display:flex;flex-direction:column;gap:.12in">${left}</div><div style="flex:1;display:flex;flex-direction:column;gap:.12in">${right}</div>`, 'flex:1;min-height:0'))];
    },
  },

  weekly: {
    group: 'Planners', label: 'Weekly planner', emoji: '🗓️', query: 'weekly planner printable', note: '7 day boxes plus a goals / notes box.',
    fields: [
      { id: 'title', label: 'Title', def: 'Weekly Planner' },
      sel('start', 'Week starts on', startOptions, '1'),
      { id: 'pages', label: 'Number of pages (1–6)', type: 'number', def: 2 },
    ],
    presets: {},
    build(v) {
      const days = rotDays(v.start);
      const page = () => col(head(v.title, 'Week of: ____________________') + `<div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,1fr);gap:.12in">
        ${days.map((d) => sec(d, ruled)).join('')}${sec('Goals & notes', todo(5), 1)}</div>`);
      return Array.from({ length: num(v.pages, 2, 1, 6) }, page);
    },
  },

  monthly: {
    group: 'Planners', label: 'Monthly calendar', emoji: '🗒️', query: 'monthly calendar printable', note: 'Real dates for any month/year — one page or all 12.',
    fields: [
      sel('mode', 'Pages', [['one', 'One month'], ['year', 'Full year (12 pages)']], 'year'),
      sel('month', 'Month (one-month mode)', monthOptions, '0'),
      { id: 'year', label: 'Year', type: 'number', def: new Date().getFullYear() + 1 },
      sel('start', 'Week starts on', startOptions, '0'),
    ],
    presets: {},
    build(v) {
      const y = num(v.year, new Date().getFullYear(), 1990, 2100);
      const names = rotDays(v.start);
      const month = (m) => {
        const offset = (new Date(y, m, 1).getDay() - Number(v.start) + 7) % 7;
        const total = dim(y, m);
        const rows = Math.ceil((offset + total) / 7);
        const cells = Array.from({ length: rows * 7 }, (_, i) => {
          const d = i - offset + 1;
          return `<div class="cellb" style="padding:3px 5px;font-size:11px;font-weight:600;color:var(--acc)">${d >= 1 && d <= total ? d : ''}</div>`;
        }).join('');
        return col(`<div style="text-align:center"><h1 class="h" style="font-size:44px;line-height:1">${MONTHS[m]}</h1><div class="small" style="font-size:14px">${y}</div></div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0;text-align:center;font-size:10px;font-weight:600">${names.map((n) => `<div class="cellb soft" style="padding:4px 0">${n.slice(0, 3).toUpperCase()}</div>`).join('')}</div>
          <div style="flex:3;min-height:0;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(${rows},1fr);margin-top:-.12in">${cells}</div>
          ${sec('Notes & goals', ruled, 0.8)}`);
      };
      return v.mode === 'one' ? [month(num(v.month, 0, 0, 11))] : MONTHS.map((_, m) => month(m));
    },
  },

  habit: {
    group: 'Planners', label: 'Habit tracker', emoji: '✅', query: 'habit tracker printable', note: 'Monthly grid, up to 31 days, plus a reflection page.',
    fields: [
      { id: 'title', label: 'Title', def: 'Habit Tracker' },
      sel('month', 'Month', [['-1', 'Undated (31 boxes)'], ...monthOptions], '-1'),
      { id: 'year', label: 'Year', type: 'number', def: new Date().getFullYear() + 1 },
      { id: 'habits', label: 'Habits (one per line)', type: 'textarea', rows: 8, def: 'Drink 8 glasses of water\nMove my body\nRead 10 pages\nSleep 8 hours\nMeditate\nNo sugary drinks\nWrite in journal\nStretch\nTake vitamins\nTidy for 10 minutes\nLearn something new\nCall someone I care about' },
    ],
    presets: {},
    build(v) {
      const m = Number(v.month), y = num(v.year, 2027, 1990, 2100);
      const days = m < 0 ? 31 : dim(y, m);
      const habits = String(v.habits).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 18);
      const cols = ['Habit', ...Array.from({ length: days }, (_, i) => String(i + 1))];
      const rows = habits.map((h) => [esc(h)]);
      while (rows.length < 12) rows.push(['']);
      const widths = ['1.7in', ...Array.from({ length: days }, () => 'auto')];
      const trk = col(head(v.title, m < 0 ? 'Month: ____________' : `${MONTHS[m]} ${y}`) + table(cols, rows, { rowH: '.52in', widths, fs: 7 }) + sec('Rewards when I hit my goal', ruled, 0.4));
      const refl = col(head('Monthly Reflection') + sec('My wins', ruled) + sec('What got in the way', ruled) + sec('What I will change next month', ruled) + sec('Habits to keep / drop / add', ruled));
      return [trk, refl];
    },
  },

  budget: {
    group: 'Planners', label: 'Budget planner', emoji: '💰', query: 'budget planner printable', note: 'Income, expenses planned vs actual, savings goals, bill tracker.',
    fields: [
      { id: 'title', label: 'Title', def: 'Monthly Budget' },
      { id: 'cur', label: 'Currency symbol', def: '$' },
      { id: 'income', label: 'Income sources (one per line)', type: 'textarea', rows: 3, def: 'Salary\nSide income\nOther' },
      { id: 'cats', label: 'Expense categories (one per line)', type: 'textarea', rows: 10, def: 'Rent / mortgage\nUtilities\nGroceries\nTransport\nInsurance\nPhone & internet\nDebt payments\nEating out\nSubscriptions\nHealth\nClothing\nGifts & giving\nSavings' },
    ],
    presets: {},
    build(v) {
      const L = (t) => String(t).split('\n').map((x) => x.trim()).filter(Boolean);
      const c = esc(v.cur || '$');
      const inc = L(v.income).map((s) => [esc(s), '', '']);
      while (inc.length < 5) inc.push(['', '', '']);
      const exp = L(v.cats).map((s) => [esc(s), '', '', '']);
      while (exp.length < 16) exp.push(['', '', '', '']);
      const summary = [['Total income', ''], ['Total expenses', ''], ['Savings', ''], ['Left to spend', '']].map(([a]) => `<div style="display:flex;gap:8px;align-items:end;border-bottom:1px solid var(--line);flex:1;font-size:12px"><b>${a}</b><span style="margin-left:auto;color:var(--acc)">${c}</span></div>`).join('');
      const p1 = col(head(v.title, 'Month: ____________') + sec('Income', table(['Source', `Planned (${c})`, `Actual (${c})`], inc, { rowH: '.3in', widths: ['44%', '28%', '28%'] }), 1.1) + row(sec('Summary', summary, 1) + sec('Savings goals', todo(4), 1), 'flex:1.2;min-height:0') + sec('Notes', ruled, 0.9));
      const p2 = col(head('Expenses', 'Planned vs actual') + `<div style="flex:1">${table(['Category', `Planned (${c})`, `Actual (${c})`, 'Difference'], exp, { rowH: '.4in', widths: ['40%', '20%', '20%', '20%'], fs: 11 })}</div>`);
      const bills = Array.from({ length: 16 }, () => ['', '', '', '<span class="chk"></span>']);
      const p3 = col(head('Bill Tracker') + `<div style="flex:1">${table(['Bill', 'Due date', `Amount (${c})`, 'Paid'], bills, { rowH: '.42in', widths: ['40%', '20%', '24%', '16%'], fs: 11 })}</div>`);
      return [p1, p2, p3];
    },
  },

  meal: {
    group: 'Planners', label: 'Meal planner', emoji: '🍽️', query: 'meal planner printable', note: 'Weekly meal grid plus a categorized grocery list.',
    fields: [
      { id: 'title', label: 'Title', def: 'Weekly Meal Plan' },
      sel('start', 'Week starts on', startOptions, '1'),
      { id: 'meals', label: 'Meals (one per line)', type: 'textarea', rows: 4, def: 'Breakfast\nLunch\nDinner\nSnacks' },
    ],
    presets: {},
    build(v) {
      const meals = String(v.meals).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 6);
      const days = rotDays(v.start);
      const rows = days.map((d) => [`<b>${d}</b>`, ...meals.map(() => '')]);
      const plan = col(head(v.title, 'Week of: ____________________') + `<div style="flex:1">${table(['Day', ...meals.map(esc)], rows, { rowH: '.95in', widths: ['1.1in'], fs: 11 })}</div>` + sec('Notes / prep', ruled, 0.5));
      const cats = ['Produce', 'Dairy & eggs', 'Meat & fish', 'Pantry', 'Frozen', 'Other'];
      const groceries = col(head('Grocery List') + `<div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,1fr);gap:.12in">${cats.map((c) => sec(c, todo(6))).join('')}</div>`);
      return [plan, groceries];
    },
  },

  todo: {
    group: 'Planners', label: 'To-do list', emoji: '☑️', query: 'to do list printable', note: 'Checklist pages with priorities.',
    fields: [
      { id: 'title', label: 'Title', def: 'To-Do List' },
      { id: 'pages', label: 'Pages (1–6)', type: 'number', def: 2 },
    ],
    presets: {},
    build(v) {
      const page = () => col(head(v.title, 'Date: ____________________') + sec('Top priorities', numbered(3), 0.7) + row(sec('To do', todo(16), 1) + sec('Later / waiting on', todo(16), 1), 'flex:3;min-height:0') + sec('Notes', ruled, 0.8));
      return Array.from({ length: num(v.pages, 2, 1, 6) }, page);
    },
  },

  goals: {
    group: 'Planners', label: 'Goal planner', emoji: '🎯', query: 'goal setting printable', note: 'Vision page, goal breakdown per life area, quarterly review.',
    fields: [
      { id: 'year', label: 'Year', def: String(new Date().getFullYear() + 1) },
      { id: 'areas', label: 'Life areas (one per line, up to 6)', type: 'textarea', rows: 6, def: 'Health\nCareer\nMoney\nRelationships\nPersonal growth\nFun & rest' },
    ],
    presets: {},
    build(v) {
      const areas = String(v.areas).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 6);
      const p1 = col(head(`${esc(v.year)} Goals`, 'My vision for the year') + sec('My word for the year', '<div style="flex:1"></div>', 0.5) + sec('This year I want to feel…', ruled, 1) + sec('I am proud of myself when…', ruled, 1) + sec('Top 3 goals', numbered(3), 1));
      const p2 = col(head('Goal Breakdown') + `<div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:.1in">${areas.map((a) => sec(a, `<div style="display:grid;grid-template-columns:1.2fr 1fr .6fr;gap:.1in;flex:1;font-size:9px"><div class="cellb" style="padding:3px">Goal</div><div class="cellb" style="padding:3px">First steps</div><div class="cellb" style="padding:3px">Deadline</div></div>`)).join('')}</div>`);
      const q = ['Q1', 'Q2', 'Q3', 'Q4'].map((n) => sec(`${n} review`, '<div style="font-size:10px;line-height:2.1">Wins:<br>Lessons:<br>Next focus:</div>' + ruled)).join('');
      const p3 = col(head('Quarterly Review') + `<div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:.12in">${q}</div>`);
      return [p1, p2, p3];
    },
  },

  gratitude: {
    group: 'Planners', label: 'Gratitude & self-care journal', emoji: '🌸', query: 'gratitude journal printable', note: 'Daily gratitude + self-care checklist and a weekly reflection.',
    fields: [
      { id: 'title', label: 'Title', def: 'Gratitude Journal' },
      { id: 'pages', label: 'Daily pages (1–6)', type: 'number', def: 2 },
      { id: 'care', label: 'Self-care checklist (one per line)', type: 'textarea', rows: 7, def: 'Drank enough water\nMoved my body\nSlept well\nSpent time outside\nAte something nourishing\nDid something just for fun\nSaid no when I needed to' },
    ],
    presets: {},
    build(v) {
      const care = String(v.care).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 9);
      const daily = () => col(head(v.title, 'Date: ____________________') + sec('Today I am grateful for', numbered(3), 1) + sec('Today’s highlight', ruled, 1) + row(sec('Self-care', care.map((c) => `<div style="display:flex;gap:7px;align-items:center;flex:1;font-size:11px"><span class="chk"></span>${esc(c)}</div>`).join(''), 1.3) + sec('Mood', '<div style="display:flex;gap:10px;flex:1;align-items:center;justify-content:center"><span class="circ"></span><span class="circ"></span><span class="circ"></span><span class="circ"></span><span class="circ"></span></div><div class="small" style="text-align:center">low ← → great</div>', 1), 'flex:1.6;min-height:0') + sec('Affirmation for tomorrow', ruled, 0.6));
      const weekly = col(head('Weekly Reflection', 'Week of: ____________________') + sec('Best moments this week', ruled) + sec('What I learned', ruled) + sec('What I want to do differently', ruled) + sec('Next week I will', todo(4)));
      return [...Array.from({ length: num(v.pages, 2, 1, 6) }, daily), weekly];
    },
  },

  workout: {
    group: 'Planners', label: 'Workout log', emoji: '💪', query: 'workout log printable', note: 'Sets, reps and weight log plus a measurements page.',
    fields: [
      { id: 'title', label: 'Title', def: 'Workout Log' },
      { id: 'pages', label: 'Log pages (1–6)', type: 'number', def: 2 },
    ],
    presets: {},
    build(v) {
      const log = () => col(head(v.title, 'Date: __________   Focus: ______________   Time: ______') + `<div style="flex:1">${table(['Exercise', 'Set 1', 'Set 2', 'Set 3', 'Set 4', 'Notes'], 15, { rowH: '.42in', widths: ['28%', '11%', '11%', '11%', '11%', '28%'], fs: 10 })}</div>` + sec('How I felt', ruled, 0.4));
      const meas = col(head('Progress & Measurements') + `<div style="flex:1">${table(['Date', 'Weight', 'Waist', 'Chest', 'Hips', 'Notes'], 14, { rowH: '.4in', widths: ['16%', '14%', '14%', '14%', '14%', '28%'] })}</div>` + sec('My goals', todo(3), 0.6));
      return [...Array.from({ length: num(v.pages, 2, 1, 6) }, log), meas];
    },
  },

  cleaning: {
    group: 'Planners', label: 'Cleaning schedule', emoji: '🧹', query: 'cleaning schedule printable', note: 'Daily grid, weekly and monthly checklists.',
    fields: [
      { id: 'title', label: 'Title', def: 'Cleaning Schedule' },
      { id: 'daily', label: 'Daily tasks (one per line)', type: 'textarea', rows: 5, def: 'Make the bed\nDo the dishes\nWipe kitchen counters\nQuick tidy\nSweep high-traffic floors' },
      { id: 'weekly', label: 'Weekly tasks (one per line)', type: 'textarea', rows: 6, def: 'Vacuum all rooms\nMop floors\nClean bathrooms\nChange bed sheets\nLaundry\nTake out trash' },
      { id: 'monthly', label: 'Monthly tasks (one per line)', type: 'textarea', rows: 6, def: 'Clean the fridge\nWash windows\nDust vents and fans\nWash bath mats\nDeclutter one drawer\nClean the oven' },
    ],
    presets: {},
    build(v) {
      const L = (t, n) => String(t).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, n);
      const daily = L(v.daily, 8).map((t) => [esc(t), `<div style="display:flex;justify-content:space-around">${'<span class="chk"></span>'.repeat(7)}</div>`]);
      const lst = (t, n) => L(t, n).map((x) => `<div style="display:flex;gap:7px;align-items:center;flex:1;font-size:11px;border-bottom:1px solid var(--line)"><span class="chk"></span>${esc(x)}</div>`).join('');
      return [col(head(v.title) + sec('Daily', table(['Task', ...'MTWTFSS'.split('')], daily.map((r) => [r[0], ...'MTWTFSS'.split('').map(() => '<span class="chk"></span>')]), { rowH: '.32in', widths: ['34%'] }), 1.3) + row(sec('Weekly', lst(v.weekly, 10), 1) + sec('Monthly', lst(v.monthly, 10), 1), 'flex:1.6;min-height:0') + sec('Notes', ruled, 0.5))];
    },
  },

  student: {
    group: 'Planners', label: 'Student planner', emoji: '🎓', query: 'student planner printable', note: 'Assignments tracker, class schedule and grades.',
    fields: [
      { id: 'title', label: 'Title', def: 'Student Planner' },
      { id: 'pages', label: 'Assignment pages (1–6)', type: 'number', def: 2 },
    ],
    presets: {},
    build(v) {
      const chk = '<span class="chk"></span>';
      const asg = () => col(head(v.title, 'Name: ______________   Week of: ______________') + `<div style="flex:1">${table(['Subject', 'Assignment', 'Due', 'Priority', 'Done'], Array.from({ length: 14 }, () => ['', '', '', '', chk]), { rowH: '.44in', widths: ['20%', '40%', '14%', '14%', '12%'] })}</div>` + sec('Exams & projects coming up', todo(3), 0.7));
      const sched = col(head('Class Schedule') + `<div style="flex:1.4">${table(['Period', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 8, { rowH: '.48in', widths: ['14%'] })}</div>` + head('Grades') + `<div style="flex:1">${table(['Subject', 'Assignment / test', 'Score', 'Grade'], 6, { rowH: '.38in', widths: ['26%', '40%', '17%', '17%'] })}</div>`);
      return [...Array.from({ length: num(v.pages, 2, 1, 6) }, asg), sched];
    },
  },
};
