// the upload as a whole is unreadable (broken JSON, not an array, missing columns), unlike a
// single invalid row
export class ImportFormatError extends Error {}
