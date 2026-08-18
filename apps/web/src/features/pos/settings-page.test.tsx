import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { AuthProvider } from "@/features/auth/AuthContext";
import { SettingsPage } from "./SettingsPage";
import {
  POS_SETTINGS_COLUMNS,
  POS_SETTINGS_EXCLUDED_ERP,
  POS_SETTINGS_SECTIONS,
} from "./pos-settings";
import { POS_SHORTCUTS } from "./pos-types";

describe("Settings page", () => {
  it("locks the heading, twelve POS sections, and does not duplicate ERP admin modules", () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <SettingsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    for (const name of POS_SETTINGS_SECTIONS) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    for (const col of POS_SETTINGS_COLUMNS) {
      expect(screen.getAllByText(col).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Coming Soon").length).toBeGreaterThan(0);
    expect(screen.getByText(POS_SHORTCUTS[0]!.key)).toBeInTheDocument();
    for (const name of POS_SETTINGS_EXCLUDED_ERP) {
      expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
      expect(screen.queryByRole("tab", { name })).not.toBeInTheDocument();
    }
  });
});
