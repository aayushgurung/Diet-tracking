import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivatePhoto } from "./private-photo";
describe("private photo access failures",()=>{
  it("replaces an expired URL with an accessible fallback and accepts renewed access",()=>{
    const {rerender}=render(<PrivatePhoto key="old" src="https://example.test/signed/old" alt="Toast" />);
    fireEvent.error(screen.getByRole("img",{name:"Toast"}));
    expect(screen.getByRole("img",{name:/photo unavailable/})).toBeVisible();
    expect(document.querySelector("img")).toBeNull();
    rerender(<PrivatePhoto key="renewed" src="https://example.test/signed/new" alt="Toast" />);
    expect(screen.getByRole("img",{name:"Toast"})).toHaveAttribute("src","https://example.test/signed/new");
  });
});
