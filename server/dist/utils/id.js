import { customAlphabet } from "nanoid";
const digits = customAlphabet("0123456789", 3);
export function createExternalEncounterId(date = new Date()) {
    const y = date.getFullYear().toString().slice(-2);
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    return `ENC-${y}${m}${d}-${digits()}`;
}
export function createExternalPatientId(date = new Date()) {
    const year = date.getFullYear();
    const seq = customAlphabet("0123456789", 4)();
    return `PT-${year}-${seq}`;
}
export function createExternalAppointmentId(date = new Date()) {
    const y = date.getFullYear().toString().slice(-2);
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    const seq = customAlphabet("0123456789", 3)();
    return `APT-${y}${m}${d}-${seq}`;
}
//# sourceMappingURL=id.js.map