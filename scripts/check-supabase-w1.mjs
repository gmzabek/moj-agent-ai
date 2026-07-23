import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const requiredTables = [
  {
    name: "conversations",
    columns: "id,created_at,title,updated_at",
  },
  {
    name: "messages",
    columns: "id,created_at,conversation_id,role,content",
  },
  {
    name: "user_profiles",
    columns: "id,created_at,name,preferences",
  },
];

function loadEnvFile(path) {
  const values = new Map();
  const content = readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);

    if (match) {
      values.set(match[1], match[2].trim());
    }
  }

  return values;
}

function formatHttpError(status, text) {
  if (status === 404) {
    return "brak tabeli albo tabela nie jest widoczna w API Supabase";
  }

  if (status === 401 || status === 403) {
    return "brak dostepu przez anon key; sprawdz RLS i uprawnienia tabeli";
  }

  return text || `HTTP ${status}`;
}

async function checkTable({ name, columns }, baseUrl, anonKey) {
  const url = new URL(`/rest/v1/${name}`, baseUrl);
  url.searchParams.set("select", columns);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) {
    return {
      name,
      ok: false,
      message: formatHttpError(response.status, await response.text()),
    };
  }

  const rows = await response.json();

  return {
    name,
    ok: true,
    message: rows.length === 0 ? "istnieje i jest pusta" : "istnieje, ale ma juz dane",
  };
}

const env = loadEnvFile(envPath);
const supabaseUrl = env.get("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Brakuje NEXT_PUBLIC_SUPABASE_URL albo NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local.");
  process.exitCode = 1;
} else {
  const results = await Promise.all(
    requiredTables.map((table) => checkTable(table, supabaseUrl, supabaseAnonKey)),
  );

  for (const result of results) {
    const marker = result.ok ? "OK" : "BRAK";
    console.log(`${marker} ${result.name}: ${result.message}`);
  }

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}
