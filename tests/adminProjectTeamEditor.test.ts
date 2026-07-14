import { describe, expect, it } from "vitest";
import {
  classifyProjectTeamAssignments,
  formatInvalidAssignmentLabel,
  getProjectAssignmentEditorPolicy,
  initialEditableTeamIds,
  invalidAssignmentWarning,
  selectableTeamsForEditor,
  toggleEditableTeamId,
} from "@/lib/adminProjectTeamEditor";

const teamA = { id: "team-a", name: "Alpha", slug: "alpha", isArchived: false };
const teamB = { id: "team-b", name: "Beta", slug: "beta", isArchived: false };
const teamArchived = { id: "team-arch", name: "Archive", slug: "archive", isArchived: true };

describe("admin project team editor helpers", () => {
  it("classifies assignments absent from the active catalog as invalid", () => {
    const classified = classifyProjectTeamAssignments(
      [
        { id: teamA.id, name: teamA.name, slug: teamA.slug },
        { id: teamArchived.id, name: "Old name", slug: "archive" },
        { id: "gone", name: "Gone", slug: "gone" },
      ],
      [teamA, teamB]
    );

    expect(classified.valid).toEqual([{ id: teamA.id, name: teamA.name, slug: teamA.slug }]);
    expect(classified.invalid).toEqual([
      { id: teamArchived.id, name: "Old name", slug: "archive", reason: "invalid" },
      { id: "gone", name: "Gone", slug: "gone", reason: "invalid" },
    ]);
  });

  it("initializes editable ids from valid assignments only", () => {
    const classified = classifyProjectTeamAssignments(
      [
        { id: teamA.id, name: teamA.name, slug: teamA.slug },
        { id: teamArchived.id, name: teamArchived.name, slug: teamArchived.slug },
      ],
      [teamA]
    );
    const policy = getProjectAssignmentEditorPolicy({
      workspaceRole: "OWNER",
      platformRole: "USER",
      teamId: null,
    });
    const ids = initialEditableTeamIds(classified, policy);
    expect(ids).toEqual([teamA.id]);
    expect(ids).not.toContain(teamArchived.id);
  });

  it("builds PATCH payload from editable ids without invalids", () => {
    const classified = classifyProjectTeamAssignments(
      [
        { id: teamA.id, name: teamA.name, slug: teamA.slug },
        { id: "gone", name: "Gone", slug: "gone" },
      ],
      [teamA, teamB]
    );
    const policy = getProjectAssignmentEditorPolicy({
      workspaceRole: "OWNER",
      platformRole: "USER",
      teamId: null,
    });
    const payload = { teamIds: initialEditableTeamIds(classified, policy) };
    expect(payload.teamIds).toEqual([teamA.id]);
    expect(payload.teamIds).not.toContain("gone");
  });

  it("shows invalid assignment warning and labels", () => {
    const classified = classifyProjectTeamAssignments(
      [{ id: teamArchived.id, name: "Archive", slug: "archive" }],
      []
    );
    expect(invalidAssignmentWarning(classified.invalid)).toMatch(/archived or invalid/i);
    expect(formatInvalidAssignmentLabel(classified.invalid[0])).toBe("Archive (invalid)");
  });

  it("keeps scoped ADMIN own team selected and non-toggleable", () => {
    const policy = getProjectAssignmentEditorPolicy({
      workspaceRole: "ADMIN",
      platformRole: "USER",
      teamId: teamA.id,
    });
    expect(policy).toEqual({ mode: "own-team-only", ownTeamId: teamA.id });

    const classified = classifyProjectTeamAssignments(
      [
        { id: teamA.id, name: teamA.name, slug: teamA.slug },
        { id: teamB.id, name: teamB.name, slug: teamB.slug },
      ],
      [teamA, teamB]
    );
    expect(initialEditableTeamIds(classified, policy)).toEqual([teamA.id]);
    expect(selectableTeamsForEditor([teamA, teamB], policy)).toEqual([teamA]);
    expect(toggleEditableTeamId([teamA.id], teamA.id, policy)).toEqual([teamA.id]);
    expect(toggleEditableTeamId([teamA.id], teamB.id, policy)).toEqual([teamA.id]);
  });

  it("allows workspace-wide managers to clear all selections", () => {
    const policy = getProjectAssignmentEditorPolicy({
      workspaceRole: "OWNER",
      platformRole: "USER",
      teamId: null,
    });
    expect(toggleEditableTeamId([teamA.id], teamA.id, policy)).toEqual([]);
    expect(selectableTeamsForEditor([teamA, teamB], policy)).toEqual([teamA, teamB]);
  });
});
