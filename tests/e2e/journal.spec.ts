import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const enabled = Boolean(url && key && email && password);

test.describe("real Supabase journal", () => {
  test.skip(!enabled, "Needs a migrated Supabase project and dedicated E2E_EMAIL/E2E_PASSWORD. No fake auth or persistence is substituted.");
  test("login, add, flag, review, repeat warning, continue, archive and isolation", async ({ page, browser }, testInfo) => {
    test.setTimeout(90_000);
    const food = `E2E toast ${testInfo.project.name} ${Date.now()}`;
    const client = createClient(url!,key!,{auth:{persistSession:false}});
    const signedIn = await client.auth.signInWithPassword({email:email!,password:password!});
    expect(signedIn.error).toBeNull();
    try {
      await page.goto("/login");
      await page.getByLabel("Email address").fill(email!);
      await page.getByLabel("Password",{exact:true}).fill(password!);
      await page.getByRole("button",{name:"Open your journal"}).click();
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/add");
      await page.getByLabel("What did you eat?").fill(food);
      await page.getByRole("button",{name:"Save to journal"}).click();
      await expect(page).toHaveURL(/saved=1/);
      await page.getByRole("link").filter({has:page.getByRole("heading",{name:food,exact:true})}).click();
      await page.getByRole("button",{name:"Mark as trigger"}).click();
      await page.getByRole("button",{name:"Stomach discomfort",exact:true}).click();
      await page.getByLabel("How did it feel?").selectOption("moderate");
      await page.getByRole("button",{name:"Flag food & save"}).click();
      await expect(page.getByRole("heading",{name:"You flagged this food"})).toBeVisible();
      await page.goto("/add");
      await page.getByLabel("What did you eat?").fill(food.toUpperCase());
      const warning = page.getByRole("status",{name:"Previous food warning"});
      await expect(warning).toContainText("Stomach discomfort");
      await expect(page.getByRole("button",{name:"Save to journal"})).toBeEnabled();
      page.once("dialog",dialog=>dialog.accept());
      await warning.getByRole("link",{name:`Review ${food}`}).click();
      await expect(page.getByRole("heading",{name:"Food & reaction history"})).toBeVisible();
      await expect(page.getByText("Stomach discomfort",{exact:false}).first()).toBeVisible();
      await page.goto("/add");
      await page.getByLabel("What did you eat?").fill(food);
      await page.getByRole("button",{name:"Continue logging"}).click();
      await page.getByRole("button",{name:"Save to journal"}).click();
      await expect(page).toHaveURL(/saved=1/);
      const matching = page.getByRole("link").filter({has:page.getByRole("heading",{name:food,exact:true})});
      await expect(matching).toHaveCount(2);
      const secondUser = process.env.E2E_OTHER_EMAIL && process.env.E2E_OTHER_PASSWORD;
      if (secondUser) {
        const isolated = await browser.newContext({baseURL:new URL(page.url()).origin});
        try {
          const other = await isolated.newPage();
          await other.goto("/login");
          await other.getByLabel("Email address").fill(process.env.E2E_OTHER_EMAIL!);
          await other.getByLabel("Password",{exact:true}).fill(process.env.E2E_OTHER_PASSWORD!);
          await other.getByRole("button",{name:"Open your journal"}).click();
          await expect(other).toHaveURL(/\/$/);
          await other.goto("/add"); await other.getByLabel("What did you eat?").fill(food);
          await expect(other.getByRole("status",{name:"Previous food warning"})).toHaveCount(0);
        } finally { await isolated.close(); }
      } else { testInfo.annotations.push({type:"isolation",description:"Second-account browser check not configured; SQL RLS and unit isolation tests cover the boundary separately."}); }
      await page.goto("/triggers");
      await page.getByRole("link").filter({has:page.getByRole("heading",{name:food,exact:true})}).click();
      await page.getByRole("button",{name:"Archive warning",exact:true}).click();
      await page.getByRole("dialog").getByRole("button",{name:"Archive warning",exact:true}).click();
      await expect(page.getByText("Warning archived",{exact:true})).toBeVisible();
      await page.goto("/add"); await page.getByLabel("What did you eat?").fill(food);
      await expect(page.getByRole("status",{name:"Previous food warning"})).toHaveCount(0);
    } finally {
      // Tests must use dedicated disposable accounts. Remove only rows with this
      // test's exact, generated name, using that user's own RLS-scoped session.
      const {data: rows} = await client.from("food_entries").select("id").eq("food_name",food);
      for (const row of rows ?? []) await client.rpc("delete_food_entry",{p_id:row.id});
      await client.from("trigger_foods").delete().eq("display_name",food);
      await client.auth.signOut();
    }
  });
});
