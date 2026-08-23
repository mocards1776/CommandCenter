import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Plaid proxy: link token, exchange, and transaction sync.
// Secrets: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox|development|production)
// Deploy: supabase functions deploy plaid

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const PLAID_HOSTS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function plaidBase(): string {
  const env = (Deno.env.get("PLAID_ENV") ?? "sandbox").toLowerCase();
  return PLAID_HOSTS[env] ?? PLAID_HOSTS.sandbox;
}

async function plaidCall<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const clientId = Deno.env.get("PLAID_CLIENT_ID");
  const secret = Deno.env.get("PLAID_SECRET");
  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set in Edge Function secrets");
  }

  const res = await fetch(`${plaidBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Plaid ${res.status}: ${text}`);
  }
  return JSON.parse(text) as T;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "other";
}

const CATEGORY_COLORS = [
  "#d9515c", "#3d9b6e", "#5b8def", "#e8a838", "#9b6fd4",
  "#4ecdc4", "#ff6b6b", "#45b7d1", "#96ceb4", "#feca57",
];

const PLAID_TO_CATEGORY: Record<string, string> = {
  FOOD_AND_DRINK: "food-drink",
  FOOD_AND_DRINK_GROCERIES: "groceries",
  FOOD_AND_DRINK_RESTAURANT: "dining",
  TRANSPORTATION: "transportation",
  TRANSPORTATION_GAS: "gas",
  TRANSPORTATION_PUBLIC_TRANSIT: "transit",
  RENT_AND_UTILITIES: "housing",
  RENT_AND_UTILITIES_RENT: "rent",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "utilities",
  GENERAL_MERCHANDISE: "shopping",
  ENTERTAINMENT: "entertainment",
  MEDICAL: "healthcare",
  PERSONAL_CARE: "personal-care",
  TRAVEL: "travel",
  INCOME: "income",
  INCOME_WAGES: "income",
  TRANSFER_IN: "transfer-in",
  TRANSFER_OUT: "transfer-out",
  LOAN_PAYMENTS: "loan-payments",
  BANK_FEES: "fees",
  GENERAL_SERVICES: "services",
};

function mapPlaidCategory(plaidCats: string[] | null | undefined): string {
  if (!plaidCats?.length) return "uncategorized";
  for (const c of plaidCats) {
    if (PLAID_TO_CATEGORY[c]) return PLAID_TO_CATEGORY[c];
  }
  return slugify(plaidCats[0] ?? "uncategorized");
}

async function ensureCategory(
  admin: ReturnType<typeof createClient>,
  userId: string,
  slug: string,
  name: string,
  isIncome = false,
): Promise<string> {
  const { data: existing } = await admin
    .from("finance_categories")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const color = CATEGORY_COLORS[slug.length % CATEGORY_COLORS.length];
  const { data: created, error } = await admin
    .from("finance_categories")
    .insert({ user_id: userId, slug, name, color, is_income: isIncome })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

async function syncItem(
  admin: ReturnType<typeof createClient>,
  userId: string,
  item: { id: string; item_id: string; access_token: string; cursor: string | null },
): Promise<{ added: number; modified: number; removed: number }> {
  let cursor = item.cursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  const accountMap = new Map<string, string>();

  while (hasMore) {
    const syncRes = await plaidCall<{
      added: PlaidTxn[];
      modified: PlaidTxn[];
      removed: { transaction_id: string }[];
      next_cursor: string;
      has_more: boolean;
      accounts: PlaidAccount[];
    }>("/transactions/sync", {
      access_token: item.access_token,
      cursor,
    });

    for (const acct of syncRes.accounts ?? []) {
      const { data: existing } = await admin
        .from("finance_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("plaid_account_id", acct.account_id)
        .maybeSingle();

      const row = {
        user_id: userId,
        plaid_item_id: item.id,
        plaid_account_id: acct.account_id,
        name: acct.name,
        official_name: acct.official_name,
        type: acct.type,
        subtype: acct.subtype,
        mask: acct.mask,
        current_balance: acct.balances.current ?? 0,
        available_balance: acct.balances.available,
        credit_limit: acct.balances.limit,
        currency: acct.balances.iso_currency_code ?? "USD",
        last_synced_at: new Date().toISOString(),
      };

      if (existing?.id) {
        await admin.from("finance_accounts").update(row).eq("id", existing.id);
        accountMap.set(acct.account_id, existing.id);
      } else {
        const { data: ins } = await admin
          .from("finance_accounts")
          .insert(row)
          .select("id")
          .single();
        if (ins) accountMap.set(acct.account_id, ins.id);
      }
    }

    const upsertTxns = async (txns: PlaidTxn[], isNew: boolean) => {
      for (const t of txns) {
        let accountId = accountMap.get(t.account_id);
        if (!accountId) {
          const { data: acct } = await admin
            .from("finance_accounts")
            .select("id")
            .eq("user_id", userId)
            .eq("plaid_account_id", t.account_id)
            .maybeSingle();
          accountId = acct?.id;
        }
        if (!accountId) continue;

        const slug = mapPlaidCategory(t.personal_finance_category?.primary
          ? [t.personal_finance_category.primary, ...(t.personal_finance_category.detailed ? [t.personal_finance_category.detailed] : [])]
          : t.category);
        const catName = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const isIncome = t.amount < 0;
        const categoryId = await ensureCategory(admin, userId, slug, catName, isIncome);

        const row = {
          user_id: userId,
          account_id: accountId,
          category_id: categoryId,
          plaid_transaction_id: t.transaction_id,
          amount: t.amount,
          name: t.name,
          merchant_name: t.merchant_name,
          pending: t.pending,
          transaction_date: t.date,
          authorized_date: t.authorized_date,
          payment_channel: t.payment_channel,
          plaid_category: t.category,
          is_transfer: slug.startsWith("transfer"),
        };

        const { error } = await admin
          .from("finance_transactions")
          .upsert(row, { onConflict: "user_id,plaid_transaction_id" });

        if (!error) {
          if (isNew) added++;
          else modified++;
        }
      }
    };

    await upsertTxns(syncRes.added, true);
    await upsertTxns(syncRes.modified, false);

    for (const r of syncRes.removed ?? []) {
      await admin
        .from("finance_transactions")
        .delete()
        .eq("user_id", userId)
        .eq("plaid_transaction_id", r.transaction_id);
      removed++;
    }

    cursor = syncRes.next_cursor;
    hasMore = syncRes.has_more;

    await admin
      .from("plaid_items")
      .update({ cursor, last_synced_at: new Date().toISOString() })
      .eq("id", item.id);
  }

  return { added, modified, removed };
}

type PlaidAccount = {
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  balances: {
    current: number | null;
    available: number | null;
    limit: number | null;
    iso_currency_code: string | null;
  };
};

type PlaidTxn = {
  transaction_id: string;
  account_id: string;
  amount: number;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  date: string;
  authorized_date: string | null;
  payment_channel: string | null;
  category: string[] | null;
  personal_finance_category?: { primary: string; detailed: string } | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const path = url.pathname
    .replace(/^\/functions\/v1/, "")
    .replace(/^\/plaid\/?/, "")
    .replace(/^\/+/, "");

  try {
    if (req.method === "GET" && path === "status") {
      const { data: items } = await admin
        .from("plaid_items")
        .select("id, institution_name, last_synced_at, created_at")
        .eq("user_id", user.id);

      const configured = !!(Deno.env.get("PLAID_CLIENT_ID") && Deno.env.get("PLAID_SECRET"));
      return json({
        configured,
        items: items ?? [],
        itemCount: items?.length ?? 0,
      });
    }

    if (req.method === "POST" && path === "link-token") {
      const body = await req.json().catch(() => ({}));
      const res = await plaidCall<{ link_token: string; expiration: string }>(
        "/link/token/create",
        {
          user: { client_user_id: user.id },
          client_name: "CommandCenter Finance",
          products: ["transactions"],
          country_codes: ["US"],
          language: "en",
          ...(body.access_token ? { access_token: body.access_token } : {}),
        },
      );
      return json(res);
    }

    if (req.method === "POST" && path === "exchange") {
      const { public_token } = await req.json();
      if (!public_token) return json({ error: "public_token required" }, 400);

      const exchange = await plaidCall<{
        access_token: string;
        item_id: string;
      }>("/item/public_token/exchange", { public_token });

      const itemInfo = await plaidCall<{
        item: { institution_id: string | null };
      }>("/item/get", { access_token: exchange.access_token });

      let institutionName: string | null = null;
      if (itemInfo.item.institution_id) {
        try {
          const inst = await plaidCall<{ institution: { name: string } }>(
            "/institutions/get_by_id",
            { institution_id: itemInfo.item.institution_id, country_codes: ["US"] },
          );
          institutionName = inst.institution.name;
        } catch {
          /* optional */
        }
      }

      const { data: item, error } = await admin
        .from("plaid_items")
        .upsert(
          {
            user_id: user.id,
            item_id: exchange.item_id,
            access_token: exchange.access_token,
            institution_id: itemInfo.item.institution_id,
            institution_name: institutionName,
          },
          { onConflict: "user_id,item_id" },
        )
        .select("id, item_id, access_token, cursor")
        .single();

      if (error) throw error;

      const syncResult = await syncItem(admin, user.id, item);

      await admin.from("integration_sync").upsert({
        user_id: user.id,
        service: "plaid",
        synced_at: new Date().toISOString(),
        detail: { item_id: exchange.item_id, ...syncResult },
      });

      return json({ item_id: exchange.item_id, institution_name: institutionName, ...syncResult });
    }

    if (req.method === "POST" && path === "sync") {
      const { data: items, error } = await admin
        .from("plaid_items")
        .select("id, item_id, access_token, cursor")
        .eq("user_id", user.id);

      if (error) throw error;
      if (!items?.length) return json({ error: "No linked accounts" }, 404);

      let totalAdded = 0;
      let totalModified = 0;
      let totalRemoved = 0;

      for (const item of items) {
        const r = await syncItem(admin, user.id, item);
        totalAdded += r.added;
        totalModified += r.modified;
        totalRemoved += r.removed;
      }

      await admin.from("integration_sync").upsert({
        user_id: user.id,
        service: "plaid",
        synced_at: new Date().toISOString(),
        detail: { added: totalAdded, modified: totalModified, removed: totalRemoved },
      });

      return json({ added: totalAdded, modified: totalModified, removed: totalRemoved });
    }

    return json({ error: `Unknown path: ${path}` }, 404);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
