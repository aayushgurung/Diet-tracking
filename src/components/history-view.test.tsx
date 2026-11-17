import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HistoryView } from "./history-view";
import { makeEntry, makeProfile, makeTrigger } from "../../tests/fixtures";
import type { JournalData } from "@/lib/types";

function data(): JournalData {
  return { profile: makeProfile(), triggers: [makeTrigger()], entries: [
    makeEntry({ id: "milk", food_name: "Milk", eaten_at: "2026-11-01T13:30:00Z", created_at: "2026-11-03T01:00:00Z" }),
    makeEntry({ id: "toast", food_name: "Avocado toast", eaten_at: "2026-11-02T01:00:00Z", is_flagged: false, reaction: null }),
    makeEntry({ id: "soup", food_name: "Vegetable soup", eaten_at: "2026-11-01T12:59:00Z", is_flagged: false, reaction: null }),
  ] };
}

describe("journal history", () => {
  it("groups by eaten time in the profile timezone, even when creation occurred later", () => {
    render(<HistoryView data={data()} />);
    fireEvent.change(screen.getByLabelText("Journal date"), { target: { value: "2026-11-02" } });
    expect(screen.getByRole("heading", { name: "Milk" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Avocado toast" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Vegetable soup" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 entries");
  });

  it("combines date, search and flag filters without showing a misleading empty journal", async () => {
    const user = userEvent.setup();
    render(<HistoryView data={data()} />);
    fireEvent.change(screen.getByLabelText("Journal date"), { target: { value: "2026-11-02" } });
    await user.selectOptions(screen.getByLabelText("Show"), "flagged");
    expect(screen.getByRole("heading", { name: "Milk" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Avocado toast" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search food names on this date"), "toast");
    expect(screen.getByRole("heading", { name: "No entries match these filters." })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("heading", { name: "Milk" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Avocado toast" })).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Show"), "unflagged");
    expect(screen.queryByRole("heading", { name: "Milk" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Avocado toast" })).toBeVisible();
  });

  it("moves backward and forward by calendar day and links to an editable entry", async () => {
    const user = userEvent.setup();
    render(<HistoryView data={data()} />);
    fireEvent.change(screen.getByLabelText("Journal date"), { target: { value: "2026-11-02" } });
    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByLabelText("Journal date")).toHaveValue("2026-11-01");
    expect(screen.getByRole("heading", { name: "Vegetable soup" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Vegetable soup/ })).toHaveAttribute("href", "/entry/soup");
    await user.click(screen.getByRole("button", { name: "Next day" }));
    expect(screen.getByLabelText("Journal date")).toHaveValue("2026-11-02");
  });
});
