/** A birth registration number is exactly 17 digits. */
export const isValidStudentId = (id: string): boolean => /^[0-9]{17}$/.test(id);
