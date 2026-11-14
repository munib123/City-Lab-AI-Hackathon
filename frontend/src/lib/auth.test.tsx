import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEMO_REPORTS } from "@/data/demo-reports";
import { reportsForPatient } from "@/lib/accounts";
import { AuthProvider, DEMO_ACCOUNTS, useAuth } from "@/lib/auth";

const STORAGE_KEY = "citylab_auth_user_session";

type AuthApi = ReturnType<typeof useAuth>;
let api: AuthApi;

/** Shows who is signed in and exactly which reports that account can see, using the same rule as every page. */
function Harness() {
  const auth = useAuth();
  api = auth;
  const mine = reportsForPatient(DEMO_REPORTS, auth.user?.patientId);
  return (
    <div>
      <span data-testid="who">{auth.user?.name ?? "signed-out"}</span>
      <ul data-testid="reports">
        {mine.map((r) => (
          <li key={r.id}>{r.patient.name}</li>
        ))}
      </ul>
    </div>
  );
}

const mount = () =>
  render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );

const visibleNames = () => screen.getByTestId("reports").textContent ?? "";
const listed = () =>
  Array.from(screen.getByTestId("reports").querySelectorAll("li")).map((li) => li.textContent);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("signing in as a demo account", () => {
  it("starts as the first demo account and sees only that person's report", () => {
    mount();
    expect(screen.getByTestId("who").textContent).toBe("Alice Smith");
    expect(listed()).toEqual(["Alice Smith"]);
  });

  it("switching to any of the 14 demo accounts shows exactly that person's report and no other", () => {
    mount();
    for (const account of DEMO_ACCOUNTS) {
      act(() => api.switchUser(account.patientId));
      expect(screen.getByTestId("who").textContent).toBe(account.name);
      expect(listed(), account.name).toEqual([account.name]);
      for (const other of DEMO_ACCOUNTS.filter((a) => a.id !== account.id)) {
        expect(visibleNames(), `${account.name} must not see ${other.name}`).not.toContain(
          other.name,
        );
      }
    }
  });

  it("remembers the chosen account, and only a clean copy of it", () => {
    mount();
    act(() => api.switchUser(DEMO_ACCOUNTS[3]!.patientId)); // Diana
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.name).toBe("Diana Prince");
    cleanup();
    mount();
    expect(screen.getByTestId("who").textContent).toBe("Diana Prince");
    expect(listed()).toEqual(["Diana Prince"]);
  });

  it("ignores a switch to a patient id that is not a demo account", () => {
    mount();
    act(() => api.switchUser("CLD-P004-9942 "));
    act(() => api.switchUser("CLD-NOBODY-0000"));
    expect(screen.getByTestId("who").textContent).toBe("Alice Smith");
  });
});

describe("a saved browser session cannot be used to reach someone else's reports", () => {
  it("repairs an old saved demo account whose patient id no longer matches (Bob used to be CLD-P002-8821)", () => {
    const bob = DEMO_ACCOUNTS.find((a) => a.name === "Bob Jones")!;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...bob, patientId: "CLD-P002-8821" }));
    mount();
    expect(screen.getByTestId("who").textContent).toBe("Bob Jones");
    expect(listed()).toEqual(["Bob Jones"]); // before the fix Bob saw no reports at all
  });

  it("rejects a forged session that claims another patient's id", () => {
    const diana = DEMO_ACCOUNTS[3]!;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: "user-evil",
        name: "Mallory",
        email: "m@x.org",
        patientId: diana.patientId,
        provider: "email",
      }),
    );
    mount();
    expect(visibleNames()).not.toContain("Diana Prince");
    expect(screen.getByTestId("who").textContent).toBe("Alice Smith"); // fell back to the default
  });

  it("falls back to the default for broken or non-user data in storage", () => {
    for (const junk of ["not json", "null", "42", '"Alice"', "[]", "{}", '{"id":"x"}']) {
      localStorage.setItem(STORAGE_KEY, junk);
      mount();
      expect(screen.getByTestId("who").textContent, junk).toBe("Alice Smith");
      cleanup();
    }
  });
});

describe("accounts that are not demo accounts", () => {
  it("a new email sign-up has an account but no reports, and sees nobody else's", async () => {
    mount();
    await act(async () =>
      api.signupWithEmail("Eleanor Vance", "eleanor@example.com", "pw", "Female"),
    );
    expect(screen.getByTestId("who").textContent).toBe("Eleanor Vance");
    expect(listed()).toEqual([]);
  });

  it("an unknown email or Google login also sees no reports", async () => {
    mount();
    await act(async () => api.loginWithEmail("someone@example.com", "pw"));
    expect(listed()).toEqual([]);
    await act(async () => api.loginWithGoogle("someone.else@gmail.com"));
    expect(listed()).toEqual([]);
  });

  it("signing in with a demo account's email opens that demo account", async () => {
    mount();
    const bob = DEMO_ACCOUNTS.find((a) => a.name === "Bob Jones")!;
    await act(async () => api.loginWithEmail(bob.email, "anything"));
    expect(listed()).toEqual(["Bob Jones"]);
  });

  it("signing out leaves no reports visible and clears the saved session", () => {
    mount();
    act(() => api.logout());
    expect(screen.getByTestId("who").textContent).toBe("signed-out");
    expect(listed()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
