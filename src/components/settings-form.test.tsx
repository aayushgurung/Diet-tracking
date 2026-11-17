import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./settings-form";
import { makeProfile } from "../../tests/fixtures";

const mocks = vi.hoisted(() => ({ saveProfile: vi.fn(), signOut: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/server/actions", () => ({ saveProfile: mocks.saveProfile, signOut: mocks.signOut }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }) }));
vi.mock("@/lib/use-unsaved-changes", () => ({ useUnsavedChanges: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveProfile.mockResolvedValue({ success: true, data: undefined });
});
afterEach(() => vi.unstubAllGlobals());

function settings(accountDeletionEnabled = true) {
  return <SettingsForm profile={makeProfile()} email="alex@example.test" accountDeletionEnabled={accountDeletionEnabled} />;
}

describe("journal settings", () => {
  it("saves validated preferences and only confirms success after persistence", async () => {
    const user = userEvent.setup();
    render(settings());
    await user.clear(screen.getByLabelText("Name or nickname"));
    await user.type(screen.getByLabelText("Name or nickname"), "  Sam  ");
    await user.click(screen.getByRole("switch", { name: /Show previous food warnings/ }));
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith({ display_name: "Sam", timezone: "Australia/Sydney", warnings_enabled: false, avatar_enabled: true }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your preferences have been saved.");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("rejects an unknown timezone before sending a preference mutation", async () => {
    const user = userEvent.setup();
    render(settings());
    await user.clear(screen.getByLabelText("Your timezone"));
    await user.type(screen.getByLabelText("Your timezone"), "Somewhere/Unknown");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(screen.getByText("Choose a valid timezone.")).toBeVisible();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("retains edits and avoids success feedback after a server failure", async () => {
    const user = userEvent.setup();
    mocks.saveProfile.mockResolvedValueOnce({ success: false, error: "Preferences were not saved. Try again." });
    render(settings());
    await user.type(screen.getByLabelText("Name or nickname"), " Smith");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Preferences were not saved");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name or nickname")).toHaveValue("Alex Smith");
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled();
  });

  it("offers the real authenticated export endpoint and a watchlist link", () => {
    render(settings());
    expect(screen.getByRole("link", { name: "Export my journal" })).toHaveAttribute("href", "/api/export");
    expect(screen.getByRole("link", { name: "Manage trigger foods" })).toHaveAttribute("href", "/triggers");
  });

  it("clearly disables unavailable account deletion", () => {
    render(settings(false));
    expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
    expect(screen.getByText(/Account deletion has not yet been enabled/)).toBeVisible();
  });

  it("requires a password and explicit DELETE confirmation, then handles a deletion error", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "That password wasn't recognised." }) });
    vi.stubGlobal("fetch", fetchMock);
    render(settings());
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const confirmation = screen.getByRole("button", { name: "Permanently delete account" });
    expect(confirmation).toBeDisabled();
    await user.type(screen.getByLabelText("Current password"), "test-password");
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "delete");
    expect(confirmation).toBeDisabled();
    await user.clear(screen.getByLabelText("Type DELETE to confirm"));
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await user.click(confirmation);
    expect(fetchMock).toHaveBeenCalledWith("/api/account", expect.objectContaining({ method: "DELETE", body: JSON.stringify({ password: "test-password", confirmation: "DELETE" }) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That password wasn't recognised.");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("redirects only after the deletion endpoint confirms completion", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
    render(settings());
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.type(screen.getByLabelText("Current password"), "test-password");
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await user.click(screen.getByRole("button", { name: "Permanently delete account" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?deleted=1"));
  });
});
