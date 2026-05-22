#!/usr/bin/env node

/**
 * check-migrations.js
 * Pre-deployment migration checker for SahiDawa.
 * Scans /supabase/migrations/, parses schema declarations,
 * and compares against schema-target.json.
 *
 * Exit 0 = fully synchronized
 * Exit 1 = gaps found (missing tables, columns, or RLS policies)
 */

const fs = require("fs");
const path = require("path");

// ─── Config ───────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");
const TARGET_SCHEMA_PATH = path.resolve(__dirname, "../supabase/schema-target.json");

// ─── ANSI Colors ──────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function log(color, symbol, msg) {
  console.log(`${color}${symbol}${c.reset} ${msg}`);
}

// ─── SQL Parser ───────────────────────────────────────────────────────────────

/**
 * Parse all migration SQL files and build a local schema state.
 * Returns: { tables: { [tableName]: { columns: Set, rls: bool, policies: Set } } }
 */
function parseMigrations(migrationsDir) {
  const schema = { tables: {} };

  if (!fs.existsSync(migrationsDir)) {
    console.error(
      `${c.red}✖${c.reset} Migrations directory not found: ${migrationsDir}`
    );
    console.error(
      `  Create the directory and add your .sql migration files there.`
    );
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // chronological by filename (e.g. 20240101_init.sql)

  if (files.length === 0) {
    log(c.yellow, "⚠", `No .sql migration files found in ${migrationsDir}`);
    return schema;
  }

  log(c.cyan, "→", `Found ${files.length} migration file(s). Parsing...\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");

    log(c.gray, " ", `Parsing: ${file}`);
    parseSQL(sql, schema);
  }

  console.log();
  return schema;
}

function parseSQL(sql, schema) {
  // Normalize: strip comments, collapse whitespace
  const normalized = sql
    .replace(/--[^\n]*/g, "")        // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/\s+/g, " ")
    .trim();

  parseCreateTable(normalized, schema);
  parseAlterTableAddColumn(normalized, schema);
  parseAlterTableEnableRLS(normalized, schema);
  parseCreatePolicy(normalized, schema);
}

function parseCreateTable(sql, schema) {
  // Matches: CREATE TABLE [IF NOT EXISTS] [schema.]tablename ( ... )
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:\w+\.)?(\w+)\s*\(([^;]+)\)/gi;
  let match;

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];

    if (!schema.tables[tableName]) {
      schema.tables[tableName] = { columns: new Set(), rls: false, policies: new Set() };
    }

    // Parse column names from the body (skip constraints)
    const lines = body.split(",");
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip table constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK)
      if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)/i.test(trimmed)) continue;
      const colMatch = trimmed.match(/^(\w+)\s+/);
      if (colMatch) {
        schema.tables[tableName].columns.add(colMatch[1].toLowerCase());
      }
    }
  }
}

function parseAlterTableAddColumn(sql, schema) {
  // Matches: ALTER TABLE tablename ADD COLUMN col1 type, ADD COLUMN col2 type, ...
  const alterTableRegex =
    /ALTER\s+TABLE\s+(?:\w+\.)?(\w+)\s+((?:ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+\w[^;]*)+)/gi;

  let tableMatch;
  while ((tableMatch = alterTableRegex.exec(sql)) !== null) {
    const tableName = tableMatch[1].toLowerCase();
    const body = tableMatch[2];

    if (!schema.tables[tableName]) {
      schema.tables[tableName] = { columns: new Set(), rls: false, policies: new Set() };
    }

    // Extract each ADD COLUMN clause
    const addColRegex =
      /ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+\w/gi;
    let colMatch;
    while ((colMatch = addColRegex.exec(body)) !== null) {
      schema.tables[tableName].columns.add(colMatch[1].toLowerCase());
    }
  }
}

function parseAlterTableEnableRLS(sql, schema) {
  // Matches: ALTER TABLE [schema.]tablename ENABLE ROW LEVEL SECURITY
  const rlsRegex =
    /ALTER\s+TABLE\s+(?:\w+\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  let match;

  while ((match = rlsRegex.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!schema.tables[tableName]) {
      schema.tables[tableName] = { columns: new Set(), rls: false, policies: new Set() };
    }
    schema.tables[tableName].rls = true;
  }
}

function parseCreatePolicy(sql, schema) {
  // Matches: CREATE POLICY "policyname" ON [schema.]tablename
  const policyRegex =
    /CREATE\s+POLICY\s+["']?(\w+)["']?\s+ON\s+(?:\w+\.)?(\w+)/gi;
  let match;

  while ((match = policyRegex.exec(sql)) !== null) {
    const policyName = match[1].toLowerCase();
    const tableName = match[2].toLowerCase();

    if (!schema.tables[tableName]) {
      schema.tables[tableName] = { columns: new Set(), rls: false, policies: new Set() };
    }
    schema.tables[tableName].policies.add(policyName);
  }
}

// ─── Comparison ───────────────────────────────────────────────────────────────

function compareSchemas(localSchema, targetSchema) {
  const gaps = [];

  for (const [tableName, targetDef] of Object.entries(targetSchema.tables)) {
    const localTable = localSchema.tables[tableName];

    // Missing table entirely
    if (!localTable) {
      gaps.push({ type: "missing_table", table: tableName });
      continue;
    }

    // Missing columns
    for (const col of targetDef.columns) {
      if (!localTable.columns.has(col.toLowerCase())) {
        gaps.push({ type: "missing_column", table: tableName, column: col });
      }
    }

    // Missing RLS
    if (targetDef.rls && !localTable.rls) {
      gaps.push({ type: "missing_rls", table: tableName });
    }

    // Missing policies
    if (targetDef.policies) {
      for (const policy of targetDef.policies) {
        if (!localTable.policies.has(policy.toLowerCase())) {
          gaps.push({ type: "missing_policy", table: tableName, policy });
        }
      }
    }
  }

  return gaps;
}

// ─── Report ───────────────────────────────────────────────────────────────────

function printReport(gaps, localSchema, targetSchema) {
  console.log(`${c.bold}═══════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}   SahiDawa — Migration Check Report       ${c.reset}`);
  console.log(`${c.bold}═══════════════════════════════════════════${c.reset}\n`);

  // Summary of what was found locally
  const localTableCount = Object.keys(localSchema.tables).length;
  const targetTableCount = Object.keys(targetSchema.tables).length;
  log(c.cyan, "📋", `Local migrations define ${localTableCount} table(s)`);
  log(c.cyan, "🎯", `Target schema expects ${targetTableCount} table(s)\n`);

  if (gaps.length === 0) {
    log(c.green, "✔", `${c.bold}All migrations are synchronized. Ready to deploy!${c.reset}`);
    console.log();
    return;
  }

  log(c.red, "✖", `${c.bold}Found ${gaps.length} gap(s):\n${c.reset}`);

  // Group gaps by table for readable output
  const byTable = {};
  for (const gap of gaps) {
    if (!byTable[gap.table]) byTable[gap.table] = [];
    byTable[gap.table].push(gap);
  }

  for (const [table, tableGaps] of Object.entries(byTable)) {
    console.log(`  ${c.bold}${c.yellow}▸ Table: ${table}${c.reset}`);
    for (const gap of tableGaps) {
      if (gap.type === "missing_table") {
        log(c.red, "    ✖", `Table ${c.bold}${table}${c.reset} is missing entirely`);
      } else if (gap.type === "missing_column") {
        log(c.red, "    ✖", `Column ${c.bold}${gap.column}${c.reset} is missing`);
      } else if (gap.type === "missing_rls") {
        log(c.red, "    ✖", `Row Level Security (RLS) is not enabled`);
      } else if (gap.type === "missing_policy") {
        log(c.red, "    ✖", `RLS Policy ${c.bold}${gap.policy}${c.reset} is missing`);
      }
    }
    console.log();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n${c.cyan}${c.bold}SahiDawa — Pre-Deployment Migration Checker${c.reset}\n`);

  // Load target schema
  if (!fs.existsSync(TARGET_SCHEMA_PATH)) {
    console.error(
      `${c.red}✖${c.reset} Target schema not found: ${TARGET_SCHEMA_PATH}`
    );
    console.error(
      `  Create supabase/schema-target.json with your expected tables and columns.`
    );
    process.exit(1);
  }

  let targetSchema;
  try {
    targetSchema = JSON.parse(fs.readFileSync(TARGET_SCHEMA_PATH, "utf8"));
  } catch (e) {
    console.error(`${c.red}✖${c.reset} Failed to parse schema-target.json: ${e.message}`);
    process.exit(1);
  }

  // Parse local migrations
  const localSchema = parseMigrations(MIGRATIONS_DIR);

  // Compare
  const gaps = compareSchemas(localSchema, targetSchema);

  // Report
  printReport(gaps, localSchema, targetSchema);

  // Exit code
  if (gaps.length > 0) {
    log(c.red, "✖", `Schema check FAILED. Fix the gaps above before deploying.\n`);
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();