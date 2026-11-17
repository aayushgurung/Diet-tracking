import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TriggerWarning } from "./trigger-warning";
import { makeEntry, makeReaction, makeTrigger, TEST_TRIGGER_ID } from "../../tests/fixtures";

describe("the personal-observation warning", () => {
  it("shows the latest real reaction and a link to its historical record", () => {
    render(<TriggerWarning matches={[makeTrigger()]} entries={[makeEntry()]} />);
    expect(screen.getByRole("heading", { name: "You flagged Milk before." })).toBeVisible();
    expect(screen.getByText("Stomach discomfort")).toBeVisible();
    expect(screen.getByRole("link", { name: "Review Milk" })).toHaveAttribute("href", `/triggers/${TEST_TRIGGER_ID}`);
    expect(screen.getByRole("img", { name: "Friendly sprout companion, caution" })).toBeVisible();
    expect(screen.getByText(/This is your personal observation/)).toBeVisible();
  });

  it("selects the newest reaction and ignores unrelated records", () => {
    render(<TriggerWarning matches={[makeTrigger()]} entries={[
      makeEntry(),
      makeEntry({ id: "new-entry", reaction: makeReaction({ symptoms: ["Bloating"], updated_at: "2026-11-10T12:00:00Z" }) }),
      makeEntry({ id: "unrelated-entry", trigger_food_id: "different-trigger", reaction: makeReaction({ symptoms: ["Unrelated symptom"], updated_at: "2026-11-12T12:00:00Z" }) }),
    ]} />);
    expect(screen.getByText("Bloating")).toBeVisible();
    expect(screen.queryByText("Stomach discomfort")).not.toBeInTheDocument();
    expect(screen.queryByText("Unrelated symptom")).not.toBeInTheDocument();
  });

  it("uses a stronger expression only for an actual historical severe report", () => {
    render(<TriggerWarning matches={[makeTrigger()]} entries={[makeEntry({ reaction: makeReaction({ severity: "severe" }) })]} />);
    expect(screen.getByRole("img", { name: "Friendly sprout companion, strong warning" })).toBeVisible();
    expect(screen.getByText("A previous report includes a severity you described as severe.")).toBeVisible();
    expect(screen.queryByText(/dangerous|allergy|unsafe/i)).not.toBeInTheDocument();
  });

  it("keeps an accompanying text warning when the companion is disabled", () => {
    render(<TriggerWarning matches={[makeTrigger()]} entries={[]} showAvatar={false} />);
    expect(screen.getByRole("heading", { name: "You flagged Milk before." })).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("You previously marked this food for review.")).toBeVisible();
  });

  it("can dismiss and restore the warning with a keyboard-accessible button", async () => {
    const user = userEvent.setup();
    render(<TriggerWarning matches={[makeTrigger()]} entries={[makeEntry()]} />);
    await user.click(screen.getByRole("button", { name: "Dismiss warning temporarily" }));
    expect(screen.queryByRole("heading", { name: "You flagged Milk before." })).not.toBeInTheDocument();
    expect(screen.getByText(/Previous warning dismissed/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show warning" }));
    expect(screen.getByRole("heading", { name: "You flagged Milk before." })).toBeVisible();
  });

  it("lets the user continue and save without requiring acknowledgement", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <TriggerWarning matches={[makeTrigger()]} entries={[makeEntry()]} />
      <button type="submit">Save entry</button>
    </form>);
    expect(screen.getByRole("button", { name: "Save entry" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Continue logging" }));
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save entry" }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("never shows another user's warning when the caller supplies the user's empty watchlist", () => {
    render(<TriggerWarning matches={[]} entries={[]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
