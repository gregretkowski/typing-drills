#!/usr/bin/env npx tsx

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

let BASEDIR = process.env.TASKS_BASEDIR || "/home/openclaw/.openclaw/workspace";
let TASKS_FILE = path.join(BASEDIR, "TASKS.md");
let TASKS_DIR = path.join(BASEDIR, "tasks");

let jsonOutput = false;

const STATES = ["Backlog", "Ready", "Active", "Blocked", "Done"];

const STATE_SYMBOL: Record<string, string> = {
  "Backlog": "[ ]",
  "Ready":   "[>]",
  "Active":  "[~]",
  "Blocked": "[!]",
  "Done":    "[x]",
};

const SYMBOL_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_SYMBOL).map(([k, v]) => [v, k])
);

const SECTION_EMOJI: Record<string, string> = {
  "Backlog": "Backlog",
  "Ready":   "Ready",
  "Active":  "Active",
  "Blocked": "Blocked",
  "Done":    "Done",
};

const PRIORITIES = ["High", "Medium", "Low"];

function today(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function nowTs(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ensureDirs(): void {
  fs.mkdirSync(BASEDIR, { recursive: true });
  fs.mkdirSync(TASKS_DIR, { recursive: true });
}

function taskFile(taskId: string): string {
  return path.join(TASKS_DIR, `${taskId}.md`);
}

function parseTaskId(raw: string): string {
  raw = raw.trim().toUpperCase();
  if (/^TASK-\d{3}$/.test(raw)) {
    return raw;
  }
  const m = raw.match(/^(\d{1,3})$/);
  if (m) {
    return `TASK-${parseInt(m[1], 10).toString().padStart(3, "0")}`;
  }
  throw new Error(`Invalid task id: '${raw}'. Use TASK-NNN or just the number.`);
}

function die(msg: string, code: number = 1, errorCode: string | null = null): never {
  if (jsonOutput) {
    const errorObj: Record<string, unknown> = { error: msg, code: errorCode || "ERROR" };
    console.error(JSON.stringify(errorObj, null, 2));
  } else {
    console.error(`Error: ${msg}`);
  }
  process.exit(code);
}

const TASK_LINE_RE = /^- (\[[ >~!x]\]) (TASK-\d{3}) \| (.+)$/;

function parseFields(rest: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of rest.split(" | ")) {
    const trimmed = part.trim();
    const idx = trimmed.indexOf(": ");
    if (idx !== -1) {
      fields[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 2).trim();
    }
  }
  return fields;
}

interface TaskEntry {
  id: string;
  title: string;
  fields: Record<string, string>;
}

interface TasksData {
  agents_comment: string | null;
  sections: Record<string, TaskEntry[]>;
}

function readTasksMd(): TasksData {
  const result: TasksData = {
    agents_comment: null,
    sections: Object.fromEntries(STATES.map(s => [s, []])),
  };

  if (!fs.existsSync(TASKS_FILE)) {
    return result;
  }

  const content = fs.readFileSync(TASKS_FILE, "utf-8");
  const lines = content.split("\n");
  let currentSection: string | null = null;

  for (const line of lines) {
    if (line.startsWith("<!-- Agents:")) {
      result.agents_comment = line;
      continue;
    }

    let matched: string | null = null;
    for (const [state, symbol] of Object.entries(STATE_SYMBOL)) {
      if (line.slice(0, 6) === `- ${symbol} `) {
        matched = state;
        break;
      }
    }
    if (matched) {
      currentSection = matched;
    }

    if (currentSection === null) continue;
    if (line.trim() === "" || line.trim() === "(none)" || line.trim() === "# Task Registry") continue;

    const m = TASK_LINE_RE.exec(line);
    if (m) {
      const [, symbol, tid, rest] = m;
      const parts = rest.split(" | ");
      const title = parts[0];
      const fields = parts.length > 1 ? parseFields(parts.slice(1).join(" | ")) : {};
      result.sections[currentSection].push({ id: tid, title, fields });
    }
  }
  return result;
}

function writeTasksMd(data: TasksData): void {
  const lines: string[] = ["# Task Registry", ""];
  if (data.agents_comment) {
    lines.push(data.agents_comment, "");
  }
  for (const state of STATES) {
    lines.push(`## ${SECTION_EMOJI[state]}`);
    const tasks = data.sections[state] || [];
    if (!tasks.length) {
      lines.push("(none)");
    } else {
      for (const t of tasks) {
        let line = `- ${STATE_SYMBOL[state]} ${t.id} | ${t.title}`;
        const orderedKeys = Object.keys(t.fields).filter(k => k !== "Agent");
        if (t.fields["Agent"]) {
          orderedKeys.push("Agent");
        }
        for (const k of orderedKeys) {
          line += ` | ${k}: ${t.fields[k]}`;
        }
        lines.push(line);
      }
    }
    lines.push("");
  }
  fs.writeFileSync(TASKS_FILE, lines.join("\n"), "utf-8");
}

function nextTaskId(data: TasksData): string {
  let highest = 0;
  for (const tasks of Object.values(data.sections)) {
    for (const t of tasks) {
      const n = parseInt(t.id.split("-")[1], 10);
      if (n > highest) highest = n;
    }
  }
  return `TASK-${(highest + 1).toString().padStart(3, "0")}`;
}

function findTask(data: TasksData, taskId: string): [string, TaskEntry] | [null, null] {
  for (const [state, tasks] of Object.entries(data.sections)) {
    for (const t of tasks) {
      if (t.id === taskId) {
        return [state, t];
      }
    }
  }
  return [null, null];
}

function removeTask(data: TasksData, taskId: string): void {
  for (const state of STATES) {
    data.sections[state] = data.sections[state].filter(t => t.id !== taskId);
  }
}

function carryAgent(oldFields: Record<string, string>, override?: string): string | null {
  const agent = override || oldFields["Agent"];
  return agent && agent !== "unassigned" ? agent : null;
}

function taskToDict(
  taskId: string,
  title: string,
  state: string,
  fields: Record<string, string>,
  _content?: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: taskId,
    title,
    state,
    priority: fields["Priority"] || "Medium",
    assignee: fields["Agent"] && fields["Agent"] !== "unassigned" ? fields["Agent"] : null,
    created_at: fields["Added"] || fields["Triaged"] || fields["Started"],
    updated_at: fields["Triaged"] || fields["Started"] || fields["Completed"] || fields["Blocked"],
  };
  if (fields["Started"]) result["started_at"] = fields["Started"];
  if (fields["Triaged"]) result["triaged_at"] = fields["Triaged"];
  if (fields["Completed"]) result["completed_at"] = fields["Completed"];
  if (fields["Blocked"]) result["blocked_reason"] = fields["Blocked"];
  if (fields["Since"]) result["blocked_since"] = fields["Since"];
  return result;
}

function tfGetField(content: string, field: string): string | null {
  const m = new RegExp(`^\\*\\*${escapeRegex(field)}\\*\\*: (.+)$`, "m").exec(content);
  return m ? m[1].trim() : null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function taskToFullDict(
  taskId: string,
  title: string,
  state: string,
  fields: Record<string, string>,
  content: string
): Record<string, unknown> {
  const base = taskToDict(taskId, title, state, fields, content);

  let description: string | null = null;
  let workLog: string[] = [];
  let clarifications: string[] = [];
  let triageSummary: string | null = null;
  let completionSummary: string | null = null;

  if (content) {
    const descMatch = /## Description\n(.*?)(?=\n## |\Z)/s.exec(content);
    if (descMatch) description = descMatch[1].trim();

    const workMatch = /## Work Log\n(.*?)(?=\n## |\Z)/s.exec(content);
    if (workMatch) {
      workLog = workMatch[1].trim().split("\n").filter(l => l.trim());
    }

    const clarMatch = /## Clarifications Log\n(.*?)(?=\n## |\Z)/s.exec(content);
    if (clarMatch) {
      clarifications = clarMatch[1].trim().split("\n").filter(l => l.trim());
    }

    const triageMatch = /## Triage Summary\n(.*?)(?=\n## |\Z)/s.exec(content);
    if (triageMatch) triageSummary = triageMatch[1].trim();

    const completeMatch = /## Completion Summary\n(.*?)(?=\n## |\Z)/s.exec(content);
    if (completeMatch) completionSummary = completeMatch[1].trim();
  }

  const goal = tfGetField(content, "Goal");
  base["description"] = description;
  base["goal"] = goal;
  base["work_log"] = workLog;
  base["clarifications"] = clarifications;
  base["triage_summary"] = triageSummary;
  base["completion_summary"] = completionSummary;

  return base;
}

function taskToSummaryDict(
  taskId: string,
  title: string,
  state: string,
  fields: Record<string, string>,
  content: string
): Record<string, unknown> {
  const goal = content ? tfGetField(content, "Goal") : null;
  const logTail = content ? tfGetSectionTail(content, "Work Log", 3) : [];
  const blockedReason = state === "Blocked" ? fields["Blocked"] || "" : null;

  return {
    id: taskId,
    title,
    state,
    goal: goal || "(not yet triaged)",
    progress: logTail.length ? logTail : [],
    next_step: blockedReason ? `Blocked: ${blockedReason}` : "(see work log)",
  };
}

function readTf(taskId: string): string | null {
  const fp = taskFile(taskId);
  return fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8") : null;
}

function writeTf(taskId: string, content: string): void {
  fs.writeFileSync(taskFile(taskId), content, "utf-8");
}

function tfSetField(content: string, field: string, value: string): string {
  const pattern = new RegExp(`^(\\*\\*${escapeRegex(field)}\\*\\*: ).+$`, "m");
  let newContent = content.replace(pattern, `$1${value}`);
  if (!pattern.test(content)) {
    const lines = newContent.split("\n");
    let insertAt = 1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\*\*.+\*\*: /.test(lines[i])) {
        insertAt = i + 1;
      }
    }
    lines.splice(insertAt, 0, `**${field}**: ${value}`);
    newContent = lines.join("\n");
  }
  return newContent;
}

function tfAppendSection(content: string, section: string, entry: string): string {
  const lines = content.split("\n");
  let inSection = false;
  let insertIdx: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.trim() === `## ${section}`) {
      inSection = true;
      continue;
    }
    if (inSection && ln.startsWith("## ")) {
      insertIdx = i;
      break;
    }
  }
  if (insertIdx !== null) {
    lines.splice(insertIdx, 0, entry);
  } else if (inSection) {
    lines.push(entry);
  } else {
    lines.push("", `## ${section}`, entry);
  }
  return lines.join("\n");
}

function tfGetSectionTail(content: string, section: string, n: number): string[] {
  const lines = content.split("\n");
  let inSec = false;
  const entries: string[] = [];
  for (const ln of lines) {
    if (ln.trim() === `## ${section}`) {
      inSec = true;
      continue;
    }
    if (inSec) {
      if (ln.startsWith("## ")) break;
      const stripped = ln.trim();
      if (stripped && !stripped.startsWith("*(")) {
        entries.push(stripped);
      }
    }
  }
  return entries.slice(-n);
}

function createTaskFile(taskId: string, title: string, priority: string, agent: string, description: string): void {
  const content = [
    `# ${taskId} | ${title}`,
    `**State**: Backlog`,
    `**Created**: ${today()}`,
    `**Priority**: ${priority}`,
    `**Agent**: ${agent}`,
    "",
    "## Description",
    description,
  ].join("\n") + "\n";
  writeTf(taskId, content);
}

interface Args {
  command?: string;
  basedir?: string;
  json?: boolean;
  force?: boolean;
  title?: string;
  description?: string;
  priority?: string;
  agent?: string;
  state?: string;
  task_id?: string;
  message?: string;
  reason?: string;
  summary?: string;
  goal?: string;
  criteria?: string[];
  access?: string;
  dependencies?: string;
  complexity?: string;
  resolution?: string;
  retriage?: boolean;
  started?: string;
  actors?: string;
  question?: boolean;
  answer?: boolean;
  agents?: string[];
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {};

  const skipNext = new Set<number>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--basedir" && i + 1 < argv.length) {
      args.basedir = argv[i + 1];
      skipNext.add(i);
      skipNext.add(i + 1);
    } else if (argv[i] === "--json") {
      args.json = true;
      skipNext.add(i);
    }
  }

  const commandIdx = argv.findIndex((arg, i) => !arg.startsWith("-") && !skipNext.has(i));
  if (commandIdx === -1) {
    return args;
  }
  args.command = argv[commandIdx];

  const remaining = argv.slice(commandIdx + 1);
  let i = 0;

  switch (args.command) {
    case "init":
      while (i < remaining.length) {
        if (remaining[i] === "--force") args.force = true;
        else if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "create":
      if (remaining[i]) args.title = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "-d" || remaining[i] === "--description") args.description = remaining[++i];
        else if (remaining[i] === "-p" || remaining[i] === "--priority") args.priority = remaining[++i];
        else if (remaining[i] === "-a" || remaining[i] === "--agent") args.agent = remaining[++i];
        else if (remaining[i] === "--json") args.json = true;
        else if (remaining[i] === "--force") args.force = true;
        i++;
      }
      break;

    case "list":
      while (i < remaining.length) {
        if (remaining[i] === "-s" || remaining[i] === "--state") args.state = remaining[++i];
        else if (remaining[i] === "-a" || remaining[i] === "--agent") args.agent = remaining[++i];
        else if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "show":
    case "status":
    case "assign":
      if (remaining[i]) args.task_id = remaining[i++];
      if (args.command === "assign" && remaining[i]) args.agent = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "triage":
    case "triage-summary":
      if (remaining[i]) args.task_id = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "-p" || remaining[i] === "--priority") args.priority = remaining[++i];
        else if (remaining[i] === "--goal") args.goal = remaining[++i];
        else if (remaining[i] === "--criteria") {
          args.criteria = [];
          while (i + 1 < remaining.length && !remaining[i + 1].startsWith("-")) {
            args.criteria.push(remaining[++i]);
          }
        } else if (remaining[i] === "--access") args.access = remaining[++i];
        else if (remaining[i] === "--dependencies") args.dependencies = remaining[++i];
        else if (remaining[i] === "--complexity") args.complexity = remaining[++i];
        else if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "start":
      if (remaining[i] && !remaining[i].startsWith("-")) args.task_id = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "-a" || remaining[i] === "--agent") args.agent = remaining[++i];
        else if (remaining[i] === "--force") args.force = true;
        else if (remaining[i] === "--json") args.json = true;
        i++;
      }
      if (!args.agent) die("error: the following arguments are required: -a/--agent", 2);
      break;

    case "log":
      if (remaining[i]) args.task_id = remaining[i++];
      if (remaining[i]) args.message = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "clarify":
      if (remaining[i]) args.task_id = remaining[i++];
      if (remaining[i]) args.message = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "--actor") args.actors = remaining[++i];
        else if (remaining[i] === "-q" || remaining[i] === "--question") args.question = true;
        else if (remaining[i] === "-A" || remaining[i] === "--answer") args.answer = true;
        else if (remaining[i] === "--json") args.json = true;
        i++;
      }
      if (!args.question && !args.answer) die("error: one of -q/--question or -A/--answer is required", 2);
      break;

    case "block":
      if (remaining[i]) args.task_id = remaining[i++];
      if (remaining[i]) args.reason = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "unblock":
      if (remaining[i]) args.task_id = remaining[i++];
      if (remaining[i]) args.resolution = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "--retriage") args.retriage = true;
        else if (remaining[i] === "--started") args.started = remaining[++i];
        else if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "done":
      if (remaining[i]) args.task_id = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "-s" || remaining[i] === "--summary") args.summary = remaining[++i];
        else if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "complete-summary":
      if (remaining[i]) args.task_id = remaining[i++];
      if (remaining[i]) args.summary = remaining.slice(i).join(" ");
      while (i < remaining.length) {
        if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "summary":
      while (i < remaining.length) {
        if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    case "set-agents":
      args.agents = [];
      while (i < remaining.length) {
        if (remaining[i] === "--json") args.json = true;
        else args.agents!.push(remaining[i]);
        i++;
      }
      break;

    case "archive":
      if (remaining[i]) args.task_id = remaining[i++];
      while (i < remaining.length) {
        if (remaining[i] === "--json") args.json = true;
        i++;
      }
      break;

    default:
      break;
  }

  return args;
}

function cmdInit(args: Args): void {
  ensureDirs();
  if (fs.existsSync(TASKS_FILE) && !args.force) {
    die(`TASKS.md already exists at ${TASKS_FILE}. Use --force to reinitialise.`, 1, "ALREADY_INITIALIZED");
  }
  const data: TasksData = { agents_comment: null, sections: Object.fromEntries(STATES.map(s => [s, []])) };
  writeTasksMd(data);

  if (jsonOutput) {
    console.log(JSON.stringify({ initialized: true, basedir: BASEDIR }, null, 2));
  } else {
    console.log(`Initialised TASKS system at ${BASEDIR}`);
  }
}

function cmdCreate(args: Args): void {
  ensureDirs();
  const data = readTasksMd();
  const taskId = nextTaskId(data);
  const priority = args.priority || "Medium";
  const agent = args.agent || "unassigned";
  const description = args.description || args.title || "";

  createTaskFile(taskId, args.title || "", priority, agent, description);

  const fields: Record<string, string> = { Added: today() };
  if (agent !== "unassigned") {
    fields["Agent"] = agent;
  }
  data.sections["Backlog"].push({ id: taskId, title: args.title || "", fields });

  writeTasksMd(data);

  if (jsonOutput) {
    console.log(JSON.stringify(taskToDict(taskId, args.title || "", "Backlog", fields), null, 2));
  } else {
    console.log(`Created ${taskId}: ${args.title}`);
    if (agent !== "unassigned") {
      console.log(`  Assigned to: ${agent}`);
    }
  }
}

function cmdList(args: Args): void {
  const data = readTasksMd();
  const statesToShow = args.state ? [args.state] : STATES;
  const allTasks: Record<string, unknown>[] = [];

  for (const state of statesToShow) {
    let tasks = data.sections[state] || [];
    if (args.agent) {
      tasks = tasks.filter(t => t.fields["Agent"] === args.agent);
    }
    if (!tasks.length) continue;
    for (const t of tasks) {
      allTasks.push(taskToDict(t.id, t.title, state, t.fields));
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(allTasks, null, 2));
  } else {
    if (!allTasks.length) {
      console.log("No tasks found.");
    } else {
      const byState: Record<string, Record<string, unknown>[]> = {};
      for (const t of allTasks) {
        const state = t["state"] as string;
        if (!byState[state]) byState[state] = [];
        byState[state].push(t);
      }

      for (const state of Object.keys(byState)) {
        const tasks = byState[state];
        console.log(`\n${"-".repeat(62)}`);
        console.log(`  ${SECTION_EMOJI[state]}  (${tasks.length})`);
        console.log(`${"-".repeat(62)}`);
        const origTasks = (data.sections[state] || []).filter(t => tasks.some(x => x["id"] === t.id));
        for (const t of origTasks) {
          const agentStr = t.fields["Agent"] ? `  [${t.fields["Agent"]}]` : "";
          const meta: string[] = [];
          for (const k of ["Priority", "Started", "Triaged", "Blocked", "Completed", "Since"]) {
            if (t.fields[k]) meta.push(`${k}: ${t.fields[k]}`);
          }
          console.log(`  ${STATE_SYMBOL[state]} ${t.id}  ${t.title}${agentStr}`);
          if (meta.length) {
            console.log(`             ${meta.join(" | ")}`);
          }
        }
      }
    }
  }
}

function cmdShow(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const data = readTasksMd();
  const [state, task] = findTask(data, taskId);
  if (!task) die(`Task ${taskId} not found in TASKS.md.`, 1, "TASK_NOT_FOUND");
  const content = readTf(taskId);
  if (!content) die(`Task file for ${taskId} not found.`, 1, "TASK_FILE_NOT_FOUND");

  if (jsonOutput) {
    console.log(JSON.stringify(taskToFullDict(taskId, task.title, state || "", task.fields, content), null, 2));
  } else {
    console.log(`\n${"=".repeat(62)}`);
    console.log(`  ${taskId} | ${task.title}`);
    console.log(`${"=".repeat(62)}`);
    console.log(`  State : ${state}  ${STATE_SYMBOL[state || ""]}`);
    for (const [k, v] of Object.entries(task.fields)) {
      console.log(`  ${k.padEnd(8)}: ${v}`);
    }
    console.log();
    console.log(content);
  }
}

function cmdStatus(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const data = readTasksMd();
  const [state, task] = findTask(data, taskId);
  if (!task) die(`Task ${taskId} not found.`, 1, "TASK_NOT_FOUND");
  const content = readTf(taskId) || "";

  if (jsonOutput) {
    console.log(JSON.stringify(taskToSummaryDict(taskId, task.title, state || "", task.fields, content), null, 2));
  } else {
    const goal = tfGetField(content, "Goal") || "(not yet triaged)";
    const logTail = tfGetSectionTail(content, "Work Log", 3);
    const progress = logTail.length ? logTail.join("\n  ") : "No work started yet.";
    const blockedReason = task.fields["Blocked"] || "";
    const nextStep = state === "Blocked" ? `Blocked: ${blockedReason}` : "(see work log)";
    console.log(`\n${taskId} (${task.title}) - ${state}\n`);
    console.log(`Goal: ${goal}\n`);
    console.log(`Progress:\n  ${progress}\n`);
    console.log(`Next step: ${nextStep}`);
  }
}

function cmdAssign(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const data = readTasksMd();
  const [state, task] = findTask(data, taskId);
  if (!task) die(`Task ${taskId} not found.`, 1, "TASK_NOT_FOUND");
  const oldAgent = task.fields["Agent"] || "unassigned";
  task.fields["Agent"] = args.agent || "";
  writeTasksMd(data);

  const content = readTf(taskId);
  if (content) {
    let newContent = tfSetField(content, "Agent", args.agent || "");
    newContent = tfAppendSection(newContent, "Work Log", `${nowTs()} - Assigned to ${args.agent} (was: ${oldAgent}).`);
    writeTf(taskId, newContent);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      task_id: taskId,
      assigned_to: args.agent,
      previous_agent: oldAgent !== "unassigned" ? oldAgent : null
    }, null, 2));
  } else {
    console.log(`${taskId} assigned to ${args.agent}.`);
  }
}

function cmdTriage(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const data = readTasksMd();
  const [state, task] = findTask(data, taskId);
  if (!task) die(`Task ${taskId} not found.`, 1, "TASK_NOT_FOUND");
  if (state !== "Backlog") die(`Task ${taskId} is in state '${state}', not Backlog.`, 1, "INVALID_STATE");

  const priority = args.priority || task.fields["Priority"] || "Medium";
  const agent = carryAgent(task.fields);

  removeTask(data, taskId);
  const fields: Record<string, string> = { Triaged: today(), Priority: priority };
  if (agent) fields["Agent"] = agent;
  data.sections["Ready"].push({ id: taskId, title: task.title, fields });
  writeTasksMd(data);

  let content = readTf(taskId);
  if (content) {
    content = tfSetField(content, "State", "Ready");
    content = tfSetField(content, "Priority", priority);
    if (!content.includes("## Triage Summary")) {
      const goal = args.goal || "(set goal here)";
      const criteria = args.criteria || ["(set success criteria here)"];
      const access = args.access || "(list tools/credentials/files needed)";
      const deps = args.dependencies || "None";
      const complexity = args.complexity || "M";
      let block = "\n## Triage Summary\n" + `**Goal**: ${goal}\n**Success Criteria**:\n`;
      for (const c of criteria) {
        block += `- ${c}\n`;
      }
      block += `**Access Confirmed**: ${access}\n**Dependencies**: ${deps}\n**Complexity**: ${complexity}\n`;
      content = content.trimEnd() + "\n" + block;
    }
    writeTf(taskId, content);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ task_id: taskId, state: "Ready", priority, assignee: agent }, null, 2));
  } else {
    console.log(`${taskId} moved to Ready (Priority: ${priority}).`);
  }
}

function cmdTriageSummary(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const content = readTf(taskId);
  if (content === null) die(`Task file for ${taskId} not found.`, 1, "TASK_FILE_NOT_FOUND");

  let newContent = content.replace(/\n## Triage Summary\n.*?(?=\n## |\Z)/s, "");
  let block = "\n## Triage Summary\n" + `**Goal**: ${args.goal}\n**Success Criteria**:\n`;
  for (const c of (args.criteria || [])) {
    block += `- ${c}\n`;
  }
  block += `**Access Confirmed**: ${args.access || "(not specified)"}\n**Dependencies**: ${args.dependencies || "None"}\n**Complexity**: ${args.complexity || "M"}\n`;
  newContent = newContent.trimEnd() + "\n" + block;
  writeTf(taskId, newContent);

  if (jsonOutput) {
    console.log(JSON.stringify({
      task_id: taskId,
      triage_summary: {
        goal: args.goal,
        criteria: args.criteria || [],
        access: args.access,
        dependencies: args.dependencies,
        complexity: args.complexity || "M"
      }
    }, null, 2));
  } else {
    console.log(`Triage summary written to ${taskId}.`);
  }
}

function cmdStart(args: Args): void {
  if (!args.agent) {
    die("error: the following arguments are required: -a/--agent", 2);
  }
  const data = readTasksMd();
  const agent = args.agent;
  let taskId: string;
  let task: TaskEntry;

  if (args.task_id) {
    taskId = parseTaskId(args.task_id);
    const [state, foundTask] = findTask(data, taskId);
    if (!foundTask) die(`Task ${taskId} not found.`, 1, "TASK_NOT_FOUND");
    if (state !== "Ready") die(`Task ${taskId} is in state '${state}', not Ready.`, 1, "INVALID_STATE");
    const taskAssigned = foundTask.fields["Agent"] || "unassigned";
    if (taskAssigned !== "unassigned" && taskAssigned !== agent && !args.force) {
      die(`Task ${taskId} is assigned to '${taskAssigned}', not '${agent}'. Use --force to override.`, 1, "ASSIGNMENT_MISMATCH");
    }
    task = foundTask;
  } else {
    const priorityOrder: Record<string, number> = { "High": 0, "Medium": 1, "Low": 2 };
    const ready = data.sections["Ready"] || [];
    const preAssigned = ready.filter(t => t.fields["Agent"] === agent);
    const unassigned = ready.filter(t => (t.fields["Agent"] || "unassigned") === "unassigned");

    const sortKey = (t: TaskEntry): [number, string] => [
      priorityOrder[t.fields["Priority"] || "Medium"] ?? 1,
      t.fields["Triaged"] || "9999-99-99"
    ];

    const candidates = preAssigned.length > 0
      ? preAssigned.sort((a, b) => sortKey(a)[0] - sortKey(b)[0])
      : unassigned.sort((a, b) => sortKey(a)[0] - sortKey(b)[0]);
    if (!candidates.length) {
      if (jsonOutput) {
        console.log(JSON.stringify({ message: "No Ready tasks available to pick up." }, null, 2));
      } else {
        console.log("No Ready tasks available to pick up.");
      }
      process.exit(0);
    }
    task = candidates[0];
    taskId = task.id;
  }

  if (!args.force) {
    const activeHeld = (data.sections["Active"] || []).filter(t => t.fields["Agent"] === agent);
    if (activeHeld.length) {
      die(`Agent '${agent}' already has Active task ${activeHeld[0].id}. Use --force to override.`, 1, "AGENT_HAS_ACTIVE_TASK");
    }
  }

  removeTask(data, taskId);
  const fields: Record<string, string> = { Started: today(), Agent: agent };
  data.sections["Active"].push({ id: taskId, title: task.title, fields });
  writeTasksMd(data);

  let content = readTf(taskId);
  if (content) {
    content = tfSetField(content, "State", "Active");
    content = tfSetField(content, "Agent", agent);
    content = tfAppendSection(content, "Work Log", `${nowTs()} - Started task.`);
    writeTf(taskId, content);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(taskToDict(taskId, task.title, "Active", fields), null, 2));
  } else {
    console.log(`${taskId} is now Active.  Agent: ${agent}`);
  }
}

function cmdLog(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const content = readTf(taskId);
  if (content === null) die(`Task file for ${taskId} not found.`, 1, "TASK_FILE_NOT_FOUND");
  const newContent = tfAppendSection(content, "Work Log", `${nowTs()} - ${args.message}`);
  writeTf(taskId, newContent);

  if (jsonOutput) {
    console.log(JSON.stringify({ task_id: taskId, logged: nowTs(), message: args.message }, null, 2));
  } else {
    console.log(`Logged to ${taskId}.`);
  }
}

function cmdClarify(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const content = readTf(taskId);
  if (content === null) die(`Task file for ${taskId} not found.`, 1, "TASK_FILE_NOT_FOUND");
  const prefix = args.question ? "Q" : "A";
  const actor = args.actors || (args.question ? "agent" : "human");
  const entry = `${prefix} (${actor}, ${today()}): ${args.message}`;
  const newContent = tfAppendSection(content, "Clarifications Log", entry);
  writeTf(taskId, newContent);

  if (jsonOutput) {
    console.log(JSON.stringify({ task_id: taskId, type: args.question ? "question" : "answer", entry }, null, 2));
  } else {
    console.log(`Clarification added to ${taskId}.`);
  }
}

function cmdBlock(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const data = readTasksMd();
  const [state, task] = findTask(data, taskId);
  if (!task) die(`Task ${taskId} not found.`, 1, "TASK_NOT_FOUND");
  if (state !== "Active") die(`Task ${taskId} is in state '${state}', not Active.`, 1, "INVALID_STATE");

  const agent = carryAgent(task.fields);
  removeTask(data, taskId);
  const fields: Record<string, string> = { Blocked: args.reason || "", Since: today() };
  if (agent) fields["Agent"] = agent;
  data.sections["Blocked"].push({ id: taskId, title: task.title, fields });
  writeTasksMd(data);

  let content = readTf(taskId);
  if (content) {
    content = tfSetField(content, "State", "Blocked");
    content = tfAppendSection(content, "Blockers Log", `${today()} - Blocked: ${args.reason}`);
    content = tfAppendSection(content, "Work Log", `${nowTs()} - Blocked. See Blockers Log.`);
    writeTf(taskId, content);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      task_id: taskId,
      state: "Blocked",
      blocked_reason: args.reason,
      blocked_since: today(),
      assignee: agent
    }, null, 2));
  } else {
    console.log(`${taskId} is now Blocked: ${args.reason}`);
  }
}

function cmdUnblock(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const data = readTasksMd();
  const [state, task] = findTask(data, taskId);
  if (!task) die(`Task ${taskId} not found.`, 1, "TASK_NOT_FOUND");
  if (state !== "Blocked") die(`Task ${taskId} is in state '${state}', not Blocked.`, 1, "INVALID_STATE");

  const agent = carryAgent(task.fields);
  const target = args.retriage ? "Ready" : "Active";

  removeTask(data, taskId);
  const fields: Record<string, string> = {};
  if (target === "Active") {
    fields["Started"] = args.started || today();
    if (agent) fields["Agent"] = agent;
  } else {
    fields["Triaged"] = today();
    fields["Priority"] = task.fields["Priority"] || "Medium";
    if (agent) fields["Agent"] = agent;
  }
  data.sections[target].push({ id: taskId, title: task.title, fields });
  writeTasksMd(data);

  let content = readTf(taskId);
  if (content) {
    content = tfSetField(content, "State", target);
    content = tfAppendSection(content, "Blockers Log", `${today()} - Resolved: ${args.resolution}`);
    content = tfAppendSection(content, "Work Log", `${nowTs()} - Resumed after blocker resolved: ${args.resolution}`);
    writeTf(taskId, content);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ task_id: taskId, state: target, resolution: args.resolution, assignee: agent }, null, 2));
  } else {
    console.log(`${taskId} unblocked -> ${target}.`);
  }
}

function cmdDone(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const data = readTasksMd();
  const [state, task] = findTask(data, taskId);
  if (!task) die(`Task ${taskId} not found.`, 1, "TASK_NOT_FOUND");
  if (state !== "Active") die(`Task ${taskId} is in state '${state}', not Active.`, 1, "INVALID_STATE");

  const agent = carryAgent(task.fields);
  const summary = args.summary || "(no completion summary provided)";

  removeTask(data, taskId);
  const fields: Record<string, string> = { Completed: today() };
  if (agent) fields["Agent"] = agent;
  data.sections["Done"].push({ id: taskId, title: task.title, fields });
  writeTasksMd(data);

  let content = readTf(taskId);
  if (content) {
    content = tfSetField(content, "State", "Done");
    content = tfAppendSection(content, "Work Log", `${nowTs()} - Task complete.`);
    if (!content.includes("## Completion Summary")) {
      content = content.trimEnd() + `\n\n## Completion Summary\n${summary}\n`;
    }
    writeTf(taskId, content);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ task_id: taskId, state: "Done", completed_at: today(), assignee: agent, summary }, null, 2));
  } else {
    console.log(`${taskId} is Done.`);
    console.log(`  Summary: ${summary}`);
  }
}

function cmdCompleteSummary(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");
  const content = readTf(taskId);
  if (content === null) die(`Task file for ${taskId} not found.`, 1, "TASK_FILE_NOT_FOUND");
  let newContent = content.replace(/\n## Completion Summary\n.*?(?=\n## |\Z)/s, "");
  newContent = newContent.trimEnd() + `\n\n## Completion Summary\n${args.summary}\n`;
  writeTf(taskId, newContent);

  if (jsonOutput) {
    console.log(JSON.stringify({ task_id: taskId, completion_summary: args.summary }, null, 2));
  } else {
    console.log(`Completion summary written to ${taskId}.`);
  }
}

function cmdSummary(_args: Args): void {
  const data = readTasksMd();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoff = cutoffDate.toISOString().split("T")[0];
  const sections = data.sections;

  if (jsonOutput) {
    const result: Record<string, unknown> = {
      date: today(),
      active: [],
      blocked: [],
      ready: [],
      completed_this_week: []
    };

    for (const t of sections["Active"] || []) {
      const content = readTf(t.id) || "";
      const entries = tfGetSectionTail(content, "Work Log", 1);
      (result["active"] as unknown[]).push({
        id: t.id,
        title: t.title,
        assignee: t.fields["Agent"] && t.fields["Agent"] !== "unassigned" ? t.fields["Agent"] : null,
        last_log: entries[0] || "no log entries"
      });
    }

    for (const t of sections["Blocked"] || []) {
      (result["blocked"] as unknown[]).push({
        id: t.id,
        title: t.title,
        assignee: t.fields["Agent"] && t.fields["Agent"] !== "unassigned" ? t.fields["Agent"] : null,
        blocked_reason: t.fields["Blocked"] || "?"
      });
    }

    result["ready"] = (sections["Ready"] || []).map(t => ({ id: t.id, title: t.title }));

    const doneRecent = (sections["Done"] || []).filter(t => (t.fields["Completed"] || "0000-00-00") >= cutoff);
    result["completed_this_week"] = doneRecent.map(t => ({ id: t.id, title: t.title }));

    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\nDaily Task Summary - ${today()}\n`);

    const active = sections["Active"] || [];
    if (active.length) {
      console.log(`Active (${active.length}):`);
      for (const t of active) {
        const content = readTf(t.id) || "";
        const entries = tfGetSectionTail(content, "Work Log", 1);
        const last = entries[0] || "no log entries";
        const agentStr = `  [${t.fields["Agent"] || "unassigned"}]`;
        console.log(`  ${t.id}${agentStr}: ${t.title}`);
        console.log(`    Last: ${last}`);
      }
      console.log();
    }

    const blocked = sections["Blocked"] || [];
    if (blocked.length) {
      console.log(`Blocked (${blocked.length}):`);
      for (const t of blocked) {
        const agentStr = `  [${t.fields["Agent"] || "unassigned"}]`;
        console.log(`  ${t.id}${agentStr}: ${t.title}`);
        console.log(`    Reason: ${t.fields["Blocked"] || "?"}`);
      }
      console.log();
    }

    const ready = sections["Ready"] || [];
    if (ready.length) {
      const ids = ready.map(t => t.id).join(", ");
      console.log(`Ready to pick up (${ready.length}): ${ids}\n`);
    }

    const doneRecent = (sections["Done"] || []).filter(t => (t.fields["Completed"] || "0000-00-00") >= cutoff);
    if (doneRecent.length) {
      const ids = doneRecent.map(t => t.id).join(", ");
      console.log(`Completed this week (${doneRecent.length}): ${ids}\n`);
    }
  }
}

function cmdSetAgents(args: Args): void {
  const data = readTasksMd();
  data.agents_comment = `<!-- Agents: ${(args.agents || []).join(", ")} -->`;
  writeTasksMd(data);

  if (jsonOutput) {
    console.log(JSON.stringify({ agents: args.agents, comment: data.agents_comment }, null, 2));
  } else {
    console.log(`Agents updated: ${data.agents_comment}`);
  }
}

function cmdArchive(args: Args): void {
  const taskId = parseTaskId(args.task_id || "");

  const tf = taskFile(taskId);
  if (!fs.existsSync(tf)) die(`Task file for ${taskId} not found.`, 1, "TASK_FILE_NOT_FOUND");

  const archiveDir = path.join(BASEDIR, "tasks-archive");
  fs.mkdirSync(archiveDir, { recursive: true });

  let content = readTf(taskId) || "";
  content = tfAppendSection(content, "Work Log", `${nowTs()} - Archived - moved to tasks-archive/`);
  writeTf(taskId, content);

  const archiveFile = path.join(archiveDir, `${taskId}.md`);
  fs.renameSync(tf, archiveFile);

  const data = readTasksMd();
  removeTask(data, taskId);
  writeTasksMd(data);

  if (jsonOutput) {
    console.log(JSON.stringify({ task_id: taskId, archived: true, archived_at: nowTs() }, null, 2));
  } else {
    console.log(`${taskId} archived.`);
  }
}

const COMMANDS: Record<string, (args: Args) => void> = {
  "init":             cmdInit,
  "create":           cmdCreate,
  "list":             cmdList,
  "show":             cmdShow,
  "status":           cmdStatus,
  "assign":           cmdAssign,
  "triage":           cmdTriage,
  "triage-summary":   cmdTriageSummary,
  "start":            cmdStart,
  "log":              cmdLog,
  "clarify":          cmdClarify,
  "block":            cmdBlock,
  "unblock":          cmdUnblock,
  "done":             cmdDone,
  "complete-summary": cmdCompleteSummary,
  "summary":          cmdSummary,
  "set-agents":       cmdSetAgents,
  "archive":          cmdArchive,
};

function printHelp(): void {
  console.log(`tasks.ts - CLI for the OpenClaw TASKS system.

All interactions with TASKS.md and tasks/TASK-NNN.md files go through this script.

Usage:
    tasks.ts <command> [options]

Commands:
    init              Initialise the workspace.
    create           Create a new task (Backlog).
    list             List tasks.
    show             Show full task detail including task file.
    status           Short status report (OP-7 format).
    assign           Assign or reassign an agent to a task (OP-9).
    triage           Move Backlog -> Ready (OP-2).
    triage-summary   Write/update Triage Summary in task file.
    start            Pick up a Ready task -> Active (OP-3).
    log              Append a Work Log entry.
    clarify          Add a Q or A to the Clarifications Log.
    block            Move Active -> Blocked (OP-5).
    unblock          Resolve a blocker (OP-6).
    done             Mark Active -> Done (OP-4).
    complete-summary Write/update Completion Summary.
    summary          Print daily summary (OP-8).
    set-agents       Update the agents roster comment in TASKS.md.
    archive          Archive a task (move to tasks-archive/).

Global Options:
    --basedir DIR     Override TASKS_BASEDIR for this invocation.
    --json            Output results as JSON instead of formatted text.

Task IDs can be given as TASK-003 or just 3.

Environment:
    TASKS_BASEDIR   workspace root  (default: /home/openclaw/.openclaw/workspace)
`);
}

function main(): void {
  const args = parseArgs();

  jsonOutput = args.json || false;

  if (args.basedir) {
    BASEDIR = args.basedir;
    TASKS_FILE = path.join(BASEDIR, "TASKS.md");
    TASKS_DIR = path.join(BASEDIR, "tasks");
    fs.mkdirSync(BASEDIR, { recursive: true });
  }

  const fn = COMMANDS[args.command || ""];
  if (!fn) {
    printHelp();
    process.exit(1);
  }
  fn(args);
}

main();
