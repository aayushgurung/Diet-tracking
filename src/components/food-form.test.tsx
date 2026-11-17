import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FoodForm } from "./food-form";
import { makeEntry, makeProfile, makeTrigger, TEST_ENTRY_ID } from "../../tests/fixtures";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/time";
import type { JournalData } from "@/lib/types";

const mocks = vi.hoisted(() => ({ saveFood: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/server/actions", () => ({ saveFood: mocks.saveFood }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/lib/use-unsaved-changes", () => ({ useUnsavedChanges: vi.fn() }));

function journal(overrides: Partial<JournalData> = {}): JournalData {
  return { profile: makeProfile(), entries: [makeEntry()], triggers: [makeTrigger()], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveFood.mockResolvedValue({ success: true, data: { id: TEST_ENTRY_ID } });
});

describe("quick food logging", () => {
  it("defaults eaten time to the profile's current local time", () => {
    const before = Date.now();
    render(<FoodForm data={journal()} />);
    const input = screen.getByLabelText(/When did you eat it/) as HTMLInputElement;
    const selected = new Date(fromDateTimeLocal(input.value, "Australia/Sydney")).getTime();
    expect(selected).toBeGreaterThan(before - 60_000);
    expect(selected).toBeLessThanOrEqual(Date.now());
    expect(screen.getByText(/Recording time is saved separately/)).toBeVisible();
  });

  it("shows a personal warning while typing, before saving", async () => {
    const user = userEvent.setup();
    render(<FoodForm data={journal()} />);
    await user.type(screen.getByLabelText(/What did you eat/), "mi");
    expect(screen.queryByRole("heading", { name: "You flagged Milk before." })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/What did you eat/), "lk");
    expect(screen.getByRole("heading", { name: "You flagged Milk before." })).toBeVisible();
    expect(screen.getByRole("img", { name: "Friendly sprout companion, caution" })).toBeVisible();
    expect(mocks.saveFood).not.toHaveBeenCalled();
  });

  it("can save a matching food without dismissing the warning", async () => {
    const user = userEvent.setup();
    render(<FoodForm data={journal()} />);
    await user.type(screen.getByLabelText(/What did you eat/), "Milk");
    await user.click(screen.getByRole("button", { name: "Save to journal" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/?saved=1"));
    expect(mocks.saveFood).toHaveBeenCalledWith(expect.objectContaining({ food_name: "Milk" }));
    expect(mocks.saveFood.mock.calls[0][0]).not.toHaveProperty("created_at");
    expect(mocks.saveFood.mock.calls[0][0]).not.toHaveProperty("is_flagged");
  });

  it("lets a user continue logging after reviewing a warning", async () => {
    const user = userEvent.setup();
    render(<FoodForm data={journal()} />);
    await user.type(screen.getByLabelText(/What did you eat/), "Whole milk");
    await user.click(screen.getByRole("button", { name: "Continue logging" }));
    expect(screen.getByRole("button", { name: "Save to journal" })).toBeEnabled();
    expect(mocks.saveFood).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save to journal" }));
    await waitFor(() => expect(mocks.saveFood).toHaveBeenCalledOnce());
  });

  it("checks a named ingredient separately and never guesses from a substring", async () => {
    const user = userEvent.setup();
    render(<FoodForm data={journal()} />);
    await user.type(screen.getByLabelText(/What did you eat/), "Coconut milk");
    expect(screen.queryByRole("heading", { name: "You flagged Milk before." })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a food or ingredient" }));
    await user.type(screen.getByRole("textbox", { name: "Item 1 name" }), "Milk");
    expect(screen.getByRole("heading", { name: "You flagged Milk before." })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save to journal" }));
    await waitFor(() => expect(mocks.saveFood).toHaveBeenCalledWith(expect.objectContaining({ components: [{ name: "Milk", kind: "ingredient" }] })));
  });

  it("shows a new warning after a different match replaces a dismissed warning", async () => {
    const user = userEvent.setup();
    render(<FoodForm data={journal({ triggers: [makeTrigger(), makeTrigger({ id: "peanut-trigger", display_name: "Peanut", normalised_name: "peanut", aliases: [] })] })} />);
    const input = screen.getByLabelText(/What did you eat/);
    await user.type(input, "Milk");
    await user.click(screen.getByRole("button", { name: "Continue logging" }));
    await user.clear(input);
    await user.type(input, "Peanut");
    expect(screen.getByRole("heading", { name: "You flagged Peanut before." })).toBeVisible();
  });

  it("uses the current user's supplied watchlist and does not retain a previous user's match", async () => {
    const user = userEvent.setup();
    const view = render(<FoodForm data={journal()} />);
    await user.type(screen.getByLabelText(/What did you eat/), "Milk");
    expect(screen.getByRole("heading", { name: "You flagged Milk before." })).toBeVisible();
    view.rerender(<FoodForm data={journal({ profile: makeProfile({ id: "different-user" }), entries: [], triggers: [] })} />);
    expect(screen.queryByRole("heading", { name: "You flagged Milk before." })).not.toBeInTheDocument();
    expect(screen.getByText("No previous warnings for this food.")).toBeVisible();
  });

  it("does not warn for archived foods and honors warning preferences", async () => {
    const user = userEvent.setup();
    const view = render(<FoodForm data={journal({ triggers: [makeTrigger({ is_active: false })] })} />);
    await user.type(screen.getByLabelText(/What did you eat/), "Milk");
    expect(screen.queryByRole("heading", { name: "You flagged Milk before." })).not.toBeInTheDocument();
    view.rerender(<FoodForm data={journal({ profile: makeProfile({ warnings_enabled: false }) })} />);
    expect(screen.queryByRole("heading", { name: "You flagged Milk before." })).not.toBeInTheDocument();
  });

  it("preserves eaten time when editing an older entry without rewriting creation time", async () => {
    const user = userEvent.setup();
    const entry = makeEntry({ notes: "Original note" });
    render(<FoodForm data={journal()} entry={entry} />);
    expect(screen.getByLabelText(/When did you eat it/)).toHaveValue(toDateTimeLocal(entry.eaten_at, "Australia/Sydney"));
    await user.type(screen.getByLabelText("Anything to remember?"), " with an update");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/entry/${TEST_ENTRY_ID}`));
    const submitted = mocks.saveFood.mock.calls[0][0];
    expect(submitted.eaten_at).toBe("2026-11-01T01:00:00.000Z");
    expect(submitted).not.toHaveProperty("created_at");
    expect(submitted.notes).toBe("Original note with an update");
  });

  it("keeps unsaved text available and allows retry after a server error", async () => {
    const user = userEvent.setup();
    mocks.saveFood.mockResolvedValueOnce({ success: false, error: "Your connection was interrupted. Please try again." });
    render(<FoodForm data={journal()} />);
    await user.type(screen.getByLabelText(/What did you eat/), "Avocado toast");
    await user.click(screen.getByRole("button", { name: "Save to journal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your connection was interrupted");
    expect(screen.getByLabelText(/What did you eat/)).toHaveValue("Avocado toast");
    expect(screen.getByRole("button", { name: "Save to journal" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save to journal" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/?saved=1"));
  });

  it("shows inline validation before sending an empty entry", async () => {
    const user = userEvent.setup();
    render(<FoodForm data={journal()} />);
    await user.click(screen.getByRole("button", { name: "Save to journal" }));
    expect(screen.getByText(/Enter a food name/)).toBeVisible();
    expect(screen.getByLabelText(/What did you eat/)).toHaveAttribute("aria-invalid", "true");
    expect(mocks.saveFood).not.toHaveBeenCalled();
  });
});
