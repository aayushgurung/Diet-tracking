import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReactionEditor } from "./reaction-editor";
import { makeEntry, makeReaction, TEST_ENTRY_ID } from "../../tests/fixtures";
import type { ActionResult } from "@/lib/types";

const mocks = vi.hoisted(() => ({ saveReaction: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/server/actions", () => ({ saveReaction: mocks.saveReaction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/use-unsaved-changes", () => ({ useUnsavedChanges: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveReaction.mockResolvedValue({ success: true, data: undefined });
});

describe("flagging and reaction notes", () => {
  it("lets a user flag a food without requiring any reaction details", async () => {
    const user = userEvent.setup();
    render(<ReactionEditor entry={makeEntry({ is_flagged: false, reaction: null })} timezone="Australia/Sydney" />);
    await user.click(screen.getByRole("button", { name: "Mark as trigger" }));
    expect(screen.getByRole("group", { name: "What did you notice?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Flag food & save" }));
    await waitFor(() => expect(mocks.saveReaction).toHaveBeenCalledWith({ food_entry_id: TEST_ENTRY_ID, symptoms: [], severity: null, reaction_at: null, onset_minutes: null, notes: "" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports several selected and custom symptoms, severity and onset", async () => {
    const user = userEvent.setup();
    render(<ReactionEditor entry={makeEntry({ is_flagged: false, reaction: null })} timezone="Australia/Sydney" />);
    await user.click(screen.getByRole("button", { name: "Mark as trigger" }));
    await user.click(screen.getByRole("button", { name: "Bloating" }));
    await user.click(screen.getByRole("button", { name: "Headache" }));
    await user.type(screen.getByLabelText("Other symptom"), "Felt tired");
    await user.click(screen.getByRole("button", { name: "Add symptom" }));
    expect(screen.getByRole("button", { name: "Remove symptom Felt tired" })).toBeVisible();
    await user.selectOptions(screen.getByLabelText("How did it feel?"), "moderate");
    await user.type(screen.getByLabelText("Or minutes after eating"), "45");
    await user.type(screen.getByLabelText("Reaction notes"), "A personal observation after lunch.");
    await user.click(screen.getByRole("button", { name: "Flag food & save" }));
    await waitFor(() => expect(mocks.saveReaction).toHaveBeenCalledWith(expect.objectContaining({ symptoms: ["Bloating", "Headache", "Felt tired"], severity: "moderate", onset_minutes: 45, notes: "A personal observation after lunch." })));
  });

  it("loads an existing report for editing and preserves its timezone-based symptom time", async () => {
    const user = userEvent.setup();
    render(<ReactionEditor entry={makeEntry({ reaction: makeReaction({ notes: "Earlier observation" }) })} timezone="Australia/Sydney" />);
    await user.click(screen.getByRole("button", { name: "Edit reaction" }));
    expect(screen.getByRole("button", { name: "Stomach discomfort" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Symptoms started")).toHaveValue("2026-11-01T13:00");
    expect(screen.getByLabelText("Reaction notes")).toHaveValue("Earlier observation");
    await user.click(screen.getByRole("button", { name: "Stomach discomfort" }));
    await user.click(screen.getByRole("button", { name: "Nausea" }));
    await user.click(screen.getByRole("button", { name: "Save reaction" }));
    await waitFor(() => expect(mocks.saveReaction).toHaveBeenCalledWith(expect.objectContaining({ symptoms: ["Nausea"], reaction_at: "2026-11-01T02:00:00.000Z", notes: "Earlier observation" })));
  });

  it("keeps the dialog and typed notes after a failed save, then allows retry", async () => {
    const user = userEvent.setup();
    mocks.saveReaction.mockResolvedValueOnce({ success: false, error: "Your observation wasn't saved. Please try again." });
    render(<ReactionEditor entry={makeEntry({ is_flagged: false, reaction: null })} timezone="Australia/Sydney" />);
    await user.click(screen.getByRole("button", { name: "Mark as trigger" }));
    await user.type(screen.getByLabelText("Reaction notes"), "Keep this note until saved.");
    await user.click(screen.getByRole("button", { name: "Flag food & save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your observation wasn't saved");
    expect(screen.getByLabelText("Reaction notes")).toHaveValue("Keep this note until saved.");
    expect(mocks.refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Flag food & save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.saveReaction).toHaveBeenCalledTimes(2);
  });

  it("prevents closure and duplicate submission while persistence is in flight", async () => {
    const user = userEvent.setup();
    let complete!: (result: ActionResult) => void;
    mocks.saveReaction.mockReturnValueOnce(new Promise<ActionResult>((resolve) => { complete = resolve; }));
    render(<ReactionEditor entry={makeEntry({ is_flagged: false, reaction: null })} timezone="Australia/Sydney" />);
    await user.click(screen.getByRole("button", { name: "Mark as trigger" }));
    await user.type(screen.getByLabelText("Reaction notes"), "Important memory");
    const form = screen.getByRole("button", { name: "Flag food & save" }).closest("form")!;
    await user.click(screen.getByRole("button", { name: "Flag food & save" }));
    fireEvent.submit(form);
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByLabelText("Reaction notes")).toHaveValue("Important memory");
    expect(mocks.saveReaction).toHaveBeenCalledOnce();
    await act(async () => { complete({ success: true, data: undefined }); });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("asks before discarding unsaved reaction changes", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ReactionEditor entry={makeEntry({ is_flagged: false, reaction: null })} timezone="Australia/Sydney" />);
    await user.click(screen.getByRole("button", { name: "Mark as trigger" }));
    await user.type(screen.getByLabelText("Reaction notes"), "Not saved yet");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledWith("Discard your unsaved reaction notes?");
    expect(screen.getByRole("dialog")).toBeVisible();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.saveReaction).not.toHaveBeenCalled();
  });
});
