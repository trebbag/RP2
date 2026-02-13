export class PhiViolationError extends Error {
    details;
    constructor(message, details) {
        super(message);
        this.name = "PhiViolationError";
        this.details = details;
    }
}
//# sourceMappingURL=types.js.map