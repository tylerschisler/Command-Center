export class NotFoundError extends Error {}
export class ValidationError extends Error {}

export function assertPermanentDeleteConfirmation(confirmation: unknown) {
  if (confirmation !== "DELETE") throw new ValidationError("Type DELETE to confirm permanent deletion.");
}
